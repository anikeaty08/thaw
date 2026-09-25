// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IHarvester } from "../interfaces/IHarvester.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { IRouter } from "../interfaces/IRouter.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";
import { IStrategyRegistry } from "../interfaces/IStrategyRegistry.sol";
import { Loan, CollateralConfig } from "../interfaces/ILoanManager.sol";
import { LoanManager } from "./LoanManager.sol";
import { RiskEngine } from "./RiskEngine.sol";

/// @title Harvester
/// @notice Permissionless weekly pipeline: claim rewards -> swap to MUSD -> pay keeper bounty and
///         protocol fee -> apply the rest to debt/surplus -> re-vote. See docs §8.4, §10.
contract Harvester is IHarvester, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 1e4;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant WEEK = 7 days;

    LoanManager public loanManager;
    RiskEngine public riskEngine;
    IRouter public router;
    IOracleRouter public oracleRouter;
    IStrategyRegistry public strategyRegistry;
    IERC20 public musd;
    address public reserveFund;

    uint256 public keeperBps = 50; // 0.5%, §9.5
    uint256 public keeperCap = 5e18; // 5 MUSD cap, §9.5
    uint256 public slippageBps = 100; // 1% max slippage, §16 threat #3

    mapping(address => bool) public allowedToken;
    mapping(address => IRouter.Route[]) internal _routes;
    mapping(uint256 => uint256) public lastHarvestEpoch;

    event RouteSet(address indexed token, uint256 hops);
    event AllowedTokenSet(address indexed token, bool allowed);
    event KeeperParamsSet(uint256 bps, uint256 cap);
    event SlippageSet(uint256 bps);

    error LoanInactive();
    error AlreadyHarvestedThisEpoch();

    constructor(
        address initialOwner,
        address _loanManager,
        address _riskEngine,
        address _router,
        address _oracleRouter,
        address _musd
    ) Ownable(initialOwner) {
        loanManager = LoanManager(_loanManager);
        riskEngine = RiskEngine(_riskEngine);
        router = IRouter(_router);
        oracleRouter = IOracleRouter(_oracleRouter);
        musd = IERC20(_musd);
    }

    // --- governance ---

    function setStrategyRegistry(address _strategyRegistry) external onlyOwner {
        strategyRegistry = IStrategyRegistry(_strategyRegistry);
    }

    function setReserveFund(address _reserveFund) external onlyOwner {
        reserveFund = _reserveFund;
    }

    function setKeeperParams(uint256 bps, uint256 cap) external onlyOwner {
        keeperBps = bps;
        keeperCap = cap;
        emit KeeperParamsSet(bps, cap);
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        slippageBps = bps;
        emit SlippageSet(bps);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedToken[token] = allowed;
        emit AllowedTokenSet(token, allowed);
    }

    function setRoute(address token, IRouter.Route[] calldata route) external onlyOwner {
        delete _routes[token];
        for (uint256 i = 0; i < route.length; i++) {
            _routes[token].push(route[i]);
        }
        emit RouteSet(token, route.length);
    }

    // --- epoch clock: unix time 0 (1970-01-01 00:00 UTC) was a Thursday, so epoch boundaries
    //     land on Thursday 00:00 UTC with no offset needed (§6.5, §10.1). ---

    function epochOf(uint256 timestamp) public pure returns (uint256) {
        return timestamp / WEEK;
    }

    // --- harvest pipeline ---
    // Intentionally not `nonReentrant`: `harvestMany` batches through `try this.harvest(...)`, which
    // requires re-entering this contract's own call frame. Safety instead comes from
    // checks-effects-interactions: `lastHarvestEpoch[loanId]` is written before any external call,
    // so the same loan can never be harvested twice, reentrantly or not.
    function harvest(uint256 loanId) public returns (uint256 musdIn) {
        Loan memory loan = loanManager.getLoan(loanId);
        if (loan.closed || loan.liquidating) revert LoanInactive();

        uint256 epoch = epochOf(block.timestamp);
        if (epoch <= lastHarvestEpoch[loanId]) revert AlreadyHarvestedThisEpoch();
        lastHarvestEpoch[loanId] = epoch;

        address borrower = loanManager.positionNFT().ownerOf(loanId);

        (address[] memory tokens, uint256[] memory amounts) = IVeAdapter(loan.adapter).claim(loan.tokenId);

        uint256 musd_;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] == 0) continue;
            if (tokens[i] == address(musd)) {
                musd_ += amounts[i];
            } else if (allowedToken[tokens[i]] && _routes[tokens[i]].length > 0) {
                musd_ += _swap(tokens[i], amounts[i]);
            } else {
                IERC20(tokens[i]).safeTransfer(borrower, amounts[i]);
                emit SwapSkipped(tokens[i], amounts[i]);
            }
        }

        CollateralConfig memory cfg = riskEngine.configOf(loan.adapter);

        uint256 bounty = (musd_ * keeperBps) / BPS;
        if (bounty > keeperCap) bounty = keeperCap;
        uint256 fee = (musd_ * cfg.protocolFeeBps) / BPS;
        uint256 remaining = musd_ - bounty - fee;
        uint256 toDebtTarget = (remaining * loan.repayShareBps) / BPS;
        uint256 surplus = remaining - toDebtTarget;

        if (bounty > 0) musd.safeTransfer(msg.sender, bounty);
        if (fee > 0 && reserveFund != address(0)) musd.safeTransfer(reserveFund, fee);
        if (surplus > 0) musd.safeTransfer(borrower, surplus);

        uint256 appliedToDebt;
        if (toDebtTarget > 0) {
            musd.safeTransfer(address(loanManager), toDebtTarget);
            appliedToDebt = loanManager.applyHarvest(loanId, toDebtTarget);
        } else {
            loanManager.applyHarvest(loanId, 0);
        }

        if (musd_ > 0) {
            riskEngine.recordHarvestIncome(loan.adapter, loan.tokenId, musd_);
        }

        bytes memory strategy = loanManager.voteStrategy(loanId);
        if (strategy.length == 0) {
            strategy = _defaultStrategy(loan.adapter);
        }
        if (strategy.length > 0) {
            IVeAdapter(loan.adapter).vote(loan.tokenId, strategy);
            emit Voted(loanId, epoch);
        }

        emit Harvested(loanId, epoch, musd_, appliedToDebt, fee, surplus, bounty);
        return musd_;
    }

    function harvestMany(uint256[] calldata loanIds) external nonReentrant returns (uint256 succeeded) {
        for (uint256 i = 0; i < loanIds.length; i++) {
            try this.harvest(loanIds[i]) returns (uint256) {
                succeeded++;
            } catch {
                continue;
            }
        }
    }

    // --- internal ---

    function _defaultStrategy(address adapter) internal view returns (bytes memory) {
        if (address(strategyRegistry) == address(0)) return "";
        IStrategyRegistry.Strategy memory s = strategyRegistry.currentStrategy(adapter);
        if (s.gauges.length == 0) return "";
        return abi.encode(s.gauges, s.weights);
    }

    function _swap(address token, uint256 amountIn) internal returns (uint256 out) {
        IRouter.Route[] memory route = _routes[token];
        uint256 minOut;
        (uint256 price, bool stale) = oracleRouter.getPriceUSD(token);
        if (!stale && price > 0) {
            uint256 quoted = (amountIn * price) / WAD;
            minOut = (quoted * (BPS - slippageBps)) / BPS;
        }
        IERC20(token).forceApprove(address(router), amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minOut, route, address(this), block.timestamp);
        out = amounts[amounts.length - 1];
        emit SwapExecuted(token, amountIn, out);
    }
}
