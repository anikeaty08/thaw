// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

enum Mode {
    Advance,
    CreditLine
}

struct Loan {
    address adapter; // which ve system
    uint256 tokenId; // veNFT id held in escrow
    Mode mode;
    uint128 principal; // MUSD outstanding (normalized by debtIndex)
    uint64 openedAt;
    uint16 repayShareBps; // share of harvested rewards applied to debt (5000-10000)
    uint16 aprBps; // fixed at open (mirrors MUSD's fixed-rate philosophy)
    uint64 lastAccrual;
    bool liquidating;
    address borrower; // snapshot; authoritative owner is the PositionNFT holder
    uint64 missedEpochs; // consecutive epochs with zero repayment (Advance backstop, §11.1)
    bool closed;
}

struct CollateralConfig {
    bool enabled;
    uint16 advanceWeeks; // k: weeks of income advanced (e.g. 10)
    uint16 incomeHaircutBps; // e.g. 7500 = 75% of trailing income counted
    uint16 maxLtvBps; // CreditLine only (e.g. 2500)
    uint16 liqLtvBps; // CreditLine liquidation threshold (e.g. 4000)
    uint16 protocolFeeBps; // cut of harvested rewards (e.g. 1000 = 10%)
    uint128 debtCeiling; // bucket cap in MUSD
    uint128 totalBorrowed; // current bucket utilization in MUSD
}

/// @notice External API of the LoanManager, the entry point for borrowers and the Harvester/Liquidator hooks.
///         See docs/THAW_SYSTEM_DESIGN.md §8.2.
interface ILoanManager {
    event LoanOpened(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed adapter,
        uint256 tokenId,
        Mode mode,
        uint256 principal
    );
    event Borrowed(uint256 indexed loanId, uint256 amount);
    event Repaid(uint256 indexed loanId, address indexed payer, uint256 amount, uint256 remainingDebt);
    event LoanClosed(uint256 indexed loanId);
    event RepayShareUpdated(uint256 indexed loanId, uint16 bps);
    event VoteStrategyUpdated(uint256 indexed loanId, bytes strategy);
    event LiquidationStarted(uint256 indexed loanId);
    event MissedEpochRecorded(uint256 indexed loanId, uint64 missedEpochs);

    function openLoan(address adapter, uint256 tokenId, Mode mode, uint256 borrowAmount, uint16 repayShareBps)
        external
        returns (uint256 loanId);

    function borrowMore(uint256 loanId, uint256 amount) external;

    function repay(uint256 loanId, uint256 amount) external;

    function closeLoan(uint256 loanId) external;

    function setRepayShare(uint256 loanId, uint16 bps) external;

    function setVoteStrategy(uint256 loanId, bytes calldata strategy) external;

    function applyHarvest(uint256 loanId, uint256 musdAmount) external returns (uint256 toDebt);

    function markLiquidating(uint256 loanId) external;

    function debtOf(uint256 loanId) external view returns (uint256);

    function maxBorrow(uint256 loanId) external view returns (uint256);

    function healthFactor(uint256 loanId) external view returns (uint256);

    function getLoan(uint256 loanId) external view returns (Loan memory);
}
