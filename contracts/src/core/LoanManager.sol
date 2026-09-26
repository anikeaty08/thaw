// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { ILoanManager, Loan, Mode, CollateralConfig } from "../interfaces/ILoanManager.sol";
import { IThawEscrow } from "../interfaces/IThawEscrow.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { IVotingEscrow } from "../interfaces/IVotingEscrow.sol";
import { ILenderVault } from "../interfaces/ILenderVault.sol";
import { RiskEngine } from "./RiskEngine.sol";
import { PositionNFT } from "./PositionNFT.sol";

/// @title LoanManager
/// @notice Entry point for borrowers; owns debt accounting and calls into the RiskEngine for
///         underwriting. See docs/THAW_SYSTEM_DESIGN.md §8.1-§8.2.
/// @dev Interest is simple, fixed-at-open per loan (mirrors MUSD's fixed-rate philosophy, §8.1),
///      accrued lazily on every state-changing call that touches `principal`.
contract LoanManager is ILoanManager, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 1e4;
    uint256 internal constant YEAR = 365 days;
    uint16 internal constant MIN_REPAY_SHARE_BPS = 5000;
    uint16 internal constant MAX_REPAY_SHARE_BPS = 10000;
    uint64 internal constant ADVANCE_DEFAULT_MISSED_EPOCHS = 8; // §11.1

    IERC20 public immutable musd;
    IThawEscrow public escrow;
    ILenderVault public vault;
    RiskEngine public riskEngine;
    PositionNFT public positionNFT;
    address public harvester;
    address public liquidator;

    mapping(address => bool) public isAdapter;
    mapping(uint256 => Loan) internal _loans;
    mapping(uint256 => bytes) public voteStrategy; // borrower-pinned strategy, §8.5
    uint256 public nextLoanId = 1;

    error NotAdapter();
    error NotEnabled();
    error BadRepayShare();
    error ZeroAmount();
    error NotOwnerOfNFT();
    error ExceedsMaxBorrow();
    error DebtCeilingBreached();
    error PayoffGuaranteeFailed();
    error LoanInactive();
    error NotBorrower();
    error NothingToRepay();
    error LoanNotClosed();
    error LoanLiquidating();
    error DebtOutstanding();
    error NotReleasable();
    error NotHarvester();
    error NotLiquidator();

    constructor(
        address initialOwner,
        address _musd,
        address _escrow,
        address _vault,
        address _riskEngine,
        address _positionNFT
    ) Ownable(initialOwner) {
        musd = IERC20(_musd);
        escrow = IThawEscrow(_escrow);
        vault = ILenderVault(_vault);
        riskEngine = RiskEngine(_riskEngine);
        positionNFT = PositionNFT(_positionNFT);
    }

    modifier onlyHarvester() {
        if (msg.sender != harvester) revert NotHarvester();
        _;
    }

    modifier onlyLiquidator() {
        if (msg.sender != liquidator) revert NotLiquidator();
        _;
    }

    // --- wiring / governance ---

    function setHarvester(address _harvester) external onlyOwner {
        harvester = _harvester;
    }

    function setLiquidator(address _liquidator) external onlyOwner {
        liquidator = _liquidator;
    }

    function setAdapter(address adapter, bool enabled) external onlyOwner {
        isAdapter[adapter] = enabled;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- borrower actions ---

    function openLoan(address adapter, uint256 tokenId, Mode mode, uint256 borrowAmount, uint16 repayShareBps)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 loanId)
    {
        if (!isAdapter[adapter]) revert NotAdapter();
        if (repayShareBps < MIN_REPAY_SHARE_BPS || repayShareBps > MAX_REPAY_SHARE_BPS) revert BadRepayShare();
        if (borrowAmount == 0) revert ZeroAmount();

        CollateralConfig memory cfg = riskEngine.configOf(adapter);
        if (!cfg.enabled) revert NotEnabled();

        address nft = IVeAdapter(adapter).escrowToken();
        if (IVotingEscrow(nft).ownerOf(tokenId) != msg.sender) revert NotOwnerOfNFT();

        uint256 cap = riskEngine.maxBorrowTotal(adapter, tokenId, mode);
        if (borrowAmount > cap) revert ExceedsMaxBorrow();
        if (!riskEngine.debtCeilingHeadroom(adapter, borrowAmount)) revert DebtCeilingBreached();

        uint16 aprBps = riskEngine.defaultAprBps(adapter);
        if (mode == Mode.Advance) {
            if (!riskEngine.validateAdvancePayoff(adapter, tokenId, borrowAmount, aprBps, repayShareBps)) {
                revert PayoffGuaranteeFailed();
            }
        }

        escrow.pull(nft, msg.sender, tokenId);

        loanId = nextLoanId++;
        Loan storage loan = _loans[loanId];
        loan.adapter = adapter;
        loan.tokenId = tokenId;
        loan.mode = mode;
        loan.principal = uint128(borrowAmount);
        loan.openedAt = uint64(block.timestamp);
        loan.repayShareBps = repayShareBps;
        loan.aprBps = aprBps;
        loan.lastAccrual = uint64(block.timestamp);
        loan.borrower = msg.sender;

        positionNFT.mint(msg.sender, loanId);
        riskEngine.noteBorrow(adapter, borrowAmount);

        vault.lendToLoanManager(borrowAmount);
        musd.safeTransfer(msg.sender, borrowAmount);

        emit LoanOpened(loanId, msg.sender, adapter, tokenId, mode, borrowAmount);
    }

    function borrowMore(uint256 loanId, uint256 amount) external whenNotPaused nonReentrant {
        Loan storage loan = _requireActive(loanId);
        if (positionNFT.ownerOf(loanId) != msg.sender) revert NotBorrower();
        if (amount == 0) revert ZeroAmount();

        uint256 debt = _accrue(loanId);
        uint256 cap = riskEngine.maxBorrowTotal(loan.adapter, loan.tokenId, loan.mode);
        if (debt + amount > cap) revert ExceedsMaxBorrow();
        if (!riskEngine.debtCeilingHeadroom(loan.adapter, amount)) revert DebtCeilingBreached();

        if (loan.mode == Mode.Advance) {
            if (!riskEngine.validateAdvancePayoff(
                    loan.adapter, loan.tokenId, debt + amount, loan.aprBps, loan.repayShareBps
                )) {
                revert PayoffGuaranteeFailed();
            }
        }

        loan.principal = uint128(debt + amount);
        riskEngine.noteBorrow(loan.adapter, amount);

        vault.lendToLoanManager(amount);
        musd.safeTransfer(msg.sender, amount);

        emit Borrowed(loanId, amount);
    }

    function repay(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.closed) revert LoanNotClosed();
        if (amount == 0) revert ZeroAmount();

        uint256 debt = _accrue(loanId);
        uint256 effective = amount > debt ? debt : amount;
        if (effective == 0) revert NothingToRepay();

        loan.principal = uint128(debt - effective);
        riskEngine.noteRepay(loan.adapter, effective);
        loan.missedEpochs = 0;

        musd.safeTransferFrom(msg.sender, address(this), effective);
        musd.forceApprove(address(vault), effective);
        vault.receiveRepayment(effective);

        emit Repaid(loanId, msg.sender, effective, debt - effective);
    }

    function closeLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.closed) revert LoanNotClosed();
        if (loan.liquidating) revert LoanLiquidating();

        uint256 debt = _accrue(loanId);
        if (debt != 0) revert DebtOutstanding();

        address owner_ = positionNFT.ownerOf(loanId);
        if (msg.sender != owner_) revert NotBorrower();

        address nft = IVeAdapter(loan.adapter).escrowToken();
        IVeAdapter(loan.adapter).prepareRelease(loan.tokenId);
        if (!IVeAdapter(loan.adapter).canRelease(loan.tokenId)) revert NotReleasable();

        loan.closed = true;
        escrow.release(nft, owner_, loan.tokenId);
        positionNFT.burn(loanId);

        emit LoanClosed(loanId);
    }

    function setRepayShare(uint256 loanId, uint16 bps) external {
        Loan storage loan = _requireActive(loanId);
        if (positionNFT.ownerOf(loanId) != msg.sender) revert NotBorrower();
        if (bps < MIN_REPAY_SHARE_BPS || bps > MAX_REPAY_SHARE_BPS) revert BadRepayShare();
        loan.repayShareBps = bps;
        emit RepayShareUpdated(loanId, bps);
    }

    /// @notice Borrower may pin gauges. Re-validated against the payoff guarantee so a pinned
    ///         strategy can't be used to starve the loan's own repayment (§8.5 anti-self-dealing).
    function setVoteStrategy(uint256 loanId, bytes calldata strategy) external {
        Loan storage loan = _requireActive(loanId);
        if (positionNFT.ownerOf(loanId) != msg.sender) revert NotBorrower();
        if (loan.mode == Mode.Advance) {
            uint256 debt = _accrue(loanId);
            if (!riskEngine.validateAdvancePayoff(loan.adapter, loan.tokenId, debt, loan.aprBps, loan.repayShareBps)) {
                revert PayoffGuaranteeFailed();
            }
        }
        voteStrategy[loanId] = strategy;
        emit VoteStrategyUpdated(loanId, strategy);
    }

    // --- Harvester hook ---

    function applyHarvest(uint256 loanId, uint256 musdAmount)
        external
        onlyHarvester
        nonReentrant
        returns (uint256 toDebt)
    {
        Loan storage loan = _loans[loanId];
        uint256 debt = _accrue(loanId);
        toDebt = musdAmount > debt ? debt : musdAmount;

        loan.principal = uint128(debt - toDebt);
        if (toDebt > 0) {
            riskEngine.noteRepay(loan.adapter, toDebt);
            loan.missedEpochs = 0;
            musd.forceApprove(address(vault), toDebt);
            vault.receiveRepayment(toDebt);
        } else {
            loan.missedEpochs += 1;
            emit MissedEpochRecorded(loanId, loan.missedEpochs);
        }

        uint256 dust = musdAmount - toDebt;
        if (dust > 0) {
            musd.safeTransfer(positionNFT.ownerOf(loanId), dust);
        }
    }

    // --- Liquidator hook ---

    function markLiquidating(uint256 loanId) external onlyLiquidator {
        _loans[loanId].liquidating = true;
        emit LiquidationStarted(loanId);
    }

    /// @notice Settles a loan whose collateral the DutchAuctionLiquidator has already sold (or
    ///         absorbed via the ReserveFund backstop). Any shortfall vs. outstanding debt is the
    ///         liquidator's responsibility to realize against the vault separately (§11.2).
    function closeLiquidatedLoan(uint256 loanId) external onlyLiquidator {
        Loan storage loan = _loans[loanId];
        if (!loan.liquidating) revert LoanInactive();
        loan.closed = true;
        loan.principal = 0;
        positionNFT.burn(loanId);
        emit LoanClosed(loanId);
    }

    // --- views ---

    function debtOf(uint256 loanId) public view returns (uint256) {
        return _accruedDebt(_loans[loanId]);
    }

    function maxBorrow(uint256 loanId) external view returns (uint256) {
        Loan memory loan = _loans[loanId];
        uint256 cap = riskEngine.maxBorrowTotal(loan.adapter, loan.tokenId, loan.mode);
        uint256 debt = _accruedDebt(loan);
        return cap > debt ? cap - debt : 0;
    }

    /// @notice CreditLine: value-based HF. Advance: uninfected by price until the 8-missed-epoch
    ///         backstop kicks in, at which point it's evaluated the same way (§11.1, §11.3).
    function healthFactor(uint256 loanId) public view returns (uint256) {
        Loan memory loan = _loans[loanId];
        uint256 debt = _accruedDebt(loan);
        if (loan.mode == Mode.CreditLine) {
            return riskEngine.healthFactorCreditLine(loan.adapter, loan.tokenId, debt);
        }
        if (loan.missedEpochs < ADVANCE_DEFAULT_MISSED_EPOCHS) return type(uint256).max;
        return riskEngine.healthFactorCreditLine(loan.adapter, loan.tokenId, debt);
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    // --- internal ---

    function _requireActive(uint256 loanId) internal view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.closed || loan.liquidating) revert LoanInactive();
    }

    function _accrue(uint256 loanId) internal returns (uint256 debt) {
        Loan storage loan = _loans[loanId];
        debt = _accruedDebt(loan);
        loan.principal = uint128(debt);
        loan.lastAccrual = uint64(block.timestamp);
    }

    function _accruedDebt(Loan memory loan) internal view returns (uint256) {
        if (loan.principal == 0) return 0;
        uint256 dt = block.timestamp - loan.lastAccrual;
        return uint256(loan.principal) + (uint256(loan.principal) * loan.aprBps * dt) / (BPS * YEAR);
    }
}
