// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { CollateralConfig, Mode } from "../interfaces/ILoanManager.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";

/// @title RiskEngine
/// @notice Underwriting math: max borrow, health factor, and the Advance-mode payoff guarantee.
///         Formulas mirror docs/THAW_SYSTEM_DESIGN.md §9 exactly (variable names match the doc).
contract RiskEngine is Ownable {
    uint256 internal constant BPS = 1e4;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant WEEK = 7 days;
    uint256 internal constant YEAR = 365 days;
    uint256 internal constant EMA_ALPHA_BPS = 5000; // alpha = 0.5, §9.1
    uint256 internal constant BOOTSTRAP_HAIRCUT_BPS = 8000; // extra 20% haircut, §9.1
    uint256 internal constant MAX_ADVANCE_PAYOFF_WEEKS = 26; // Tmax, §9.2

    address public harvester;
    IOracleRouter public oracleRouter;

    mapping(address => CollateralConfig) internal _config;
    // Not part of CollateralConfig (§8.1) since APR is fixed per-loan at open, not a bucket cap;
    // this is the *default* an adapter's new loans open at (§9.5 table).
    mapping(address => uint16) public defaultAprBps;
    // adapter => tokenId => trailing weekly income EMA (MUSD, 1e18)
    mapping(address => mapping(uint256 => uint256)) public trailingIncome;
    mapping(address => mapping(uint256 => bool)) public hasHistory;

    event ConfigSet(address indexed adapter, CollateralConfig config);
    event HarvesterSet(address indexed harvester);
    event OracleRouterSet(address indexed oracleRouter);
    event IncomeRecorded(address indexed adapter, uint256 indexed tokenId, uint256 sample, uint256 newEma);
    event BucketUtilizationUpdated(address indexed adapter, uint128 totalBorrowed);

    error NotHarvester();
    error NotEnabled();

    constructor(address initialOwner) Ownable(initialOwner) { }

    modifier onlyHarvester() {
        if (msg.sender != harvester) revert NotHarvester();
        _;
    }

    // --- wiring / governance ---

    function setHarvester(address _harvester) external onlyOwner {
        harvester = _harvester;
        emit HarvesterSet(_harvester);
    }

    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = IOracleRouter(_oracleRouter);
        emit OracleRouterSet(_oracleRouter);
    }

    function setConfig(address adapter, CollateralConfig calldata cfg) external onlyOwner {
        CollateralConfig storage existing = _config[adapter];
        existing.enabled = cfg.enabled;
        existing.advanceWeeks = cfg.advanceWeeks;
        existing.incomeHaircutBps = cfg.incomeHaircutBps;
        existing.maxLtvBps = cfg.maxLtvBps;
        existing.liqLtvBps = cfg.liqLtvBps;
        existing.protocolFeeBps = cfg.protocolFeeBps;
        existing.debtCeiling = cfg.debtCeiling;
        emit ConfigSet(adapter, existing);
    }

    function configOf(address adapter) external view returns (CollateralConfig memory) {
        return _config[adapter];
    }

    function setDefaultApr(address adapter, uint16 aprBps) external onlyOwner {
        defaultAprBps[adapter] = aprBps;
    }

    // --- LoanManager-facing bucket accounting ---
    // LoanManager is authorized indirectly: it never writes CollateralConfig fields other than
    // totalBorrowed, and only in lockstep with an actual borrow/repay, so we allow any caller to
    // *read* but gate the mutator through the harvester-equivalent pattern used elsewhere: the
    // LoanManager address is registered as a second privileged caller.
    address public loanManager;

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    modifier onlyLoanManager() {
        require(msg.sender == loanManager, "RiskEngine: not loan manager");
        _;
    }

    function noteBorrow(address adapter, uint256 amount) external onlyLoanManager {
        _bumpUtilization(adapter, uint128(amount), true);
    }

    function noteRepay(address adapter, uint256 amount) external onlyLoanManager {
        _bumpUtilization(adapter, uint128(amount), false);
    }

    function _bumpUtilization(address adapter, uint128 delta, bool increase) internal {
        CollateralConfig storage cfg = _config[adapter];
        if (increase) {
            cfg.totalBorrowed += delta;
        } else {
            cfg.totalBorrowed = delta >= cfg.totalBorrowed ? 0 : cfg.totalBorrowed - delta;
        }
        emit BucketUtilizationUpdated(adapter, cfg.totalBorrowed);
    }

    // --- income tracking (§9.1) ---

    function recordHarvestIncome(address adapter, uint256 tokenId, uint256 musdAmount) external onlyHarvester {
        uint256 old = trailingIncome[adapter][tokenId];
        uint256 newEma;
        if (!hasHistory[adapter][tokenId]) {
            newEma = musdAmount;
            hasHistory[adapter][tokenId] = true;
        } else {
            newEma = (musdAmount * EMA_ALPHA_BPS + old * (BPS - EMA_ALPHA_BPS)) / BPS;
        }
        trailingIncome[adapter][tokenId] = newEma;
        emit IncomeRecorded(adapter, tokenId, musdAmount, newEma);
    }

    /// @notice Weekly income estimate used for underwriting: the EMA once history exists, otherwise
    ///         a haircut bootstrap off the adapter's currently-pending rewards.
    function estimateWeeklyIncomeUSD(address adapter, uint256 tokenId) public view returns (uint256) {
        if (hasHistory[adapter][tokenId]) {
            return trailingIncome[adapter][tokenId];
        }
        (address[] memory tokens, uint256[] memory amounts) = IVeAdapter(adapter).pendingRewards(tokenId);
        uint256 usd = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] == 0) continue;
            (uint256 price,) = oracleRouter.getPriceUSD(tokens[i]);
            usd += (amounts[i] * price) / WAD;
        }
        return (usd * BOOTSTRAP_HAIRCUT_BPS) / BPS;
    }

    // --- Advance mode (§9.2) ---

    function maxAdvance(address adapter, uint256 tokenId) public view returns (uint256) {
        CollateralConfig memory cfg = _config[adapter];
        if (!cfg.enabled) return 0;
        uint256 iw = estimateWeeklyIncomeUSD(adapter, tokenId);
        return (iw * cfg.incomeHaircutBps * cfg.advanceWeeks) / BPS;
    }

    /// @notice Payoff guarantee: principal*(1+apr*T) <= I_w*h*repayShare*T must hold for some T<=Tmax.
    ///         Since both sides are linear in T and the RHS-minus-LHS slope
    ///         (I_w*h*repayShare - principal*apr) is what matters, the inequality is easiest to
    ///         satisfy at T = Tmax when the weekly paydown exceeds weekly interest accrual, and
    ///         impossible for any T otherwise unless principal is already covered by T=0. We check
    ///         T = Tmax directly, which is the binding case.
    function validateAdvancePayoff(
        address adapter,
        uint256 tokenId,
        uint256 principal,
        uint16 aprBps,
        uint16 repayShareBps
    ) external view returns (bool) {
        if (principal == 0) return true;
        CollateralConfig memory cfg = _config[adapter];
        uint256 iw = estimateWeeklyIncomeUSD(adapter, tokenId);
        uint256 weeklyPaydown = (iw * cfg.incomeHaircutBps * repayShareBps) / (BPS * BPS);
        uint256 tMaxWeeks = MAX_ADVANCE_PAYOFF_WEEKS;
        uint256 lhs = principal + (principal * aprBps * tMaxWeeks * WEEK) / (BPS * YEAR);
        uint256 rhs = weeklyPaydown * tMaxWeeks;
        return rhs >= lhs;
    }

    // --- Credit Line mode (§9.3) ---

    function maxCreditLine(address adapter, uint256 tokenId) public view returns (uint256) {
        CollateralConfig memory cfg = _config[adapter];
        if (!cfg.enabled) return 0;
        uint256 v = IVeAdapter(adapter).collateralValueUSD(tokenId);
        return (v * cfg.maxLtvBps) / BPS;
    }

    function healthFactorCreditLine(address adapter, uint256 tokenId, uint256 debt) public view returns (uint256) {
        if (debt == 0) return type(uint256).max;
        CollateralConfig memory cfg = _config[adapter];
        uint256 v = IVeAdapter(adapter).collateralValueUSD(tokenId);
        return (v * cfg.liqLtvBps * WAD) / (BPS * debt);
    }

    // --- dispatch ---

    function maxBorrowTotal(address adapter, uint256 tokenId, Mode mode) external view returns (uint256) {
        return mode == Mode.Advance ? maxAdvance(adapter, tokenId) : maxCreditLine(adapter, tokenId);
    }

    function debtCeilingHeadroom(address adapter, uint256 amount) external view returns (bool ok) {
        CollateralConfig memory cfg = _config[adapter];
        return uint256(cfg.totalBorrowed) + amount <= cfg.debtCeiling;
    }
}
