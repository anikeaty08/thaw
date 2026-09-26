// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IMUSDSavingsRate } from "../interfaces/IMUSDSavingsRate.sol";

/// @title TMUSDVault
/// @notice ERC-4626 lender vault. Deploys MUSD to the LoanManager, parks idle MUSD in the MUSD
///         Savings Rate as a yield floor, and exposes a FIFO redemption queue for withdrawals
///         beyond instant idle liquidity. See docs/THAW_SYSTEM_DESIGN.md §12.
/// @dev totalAssets = idle + deployedInMSR + totalLent - badDebtProvision (§12 accounting line).
///      Inflation-attack protection: OZ4626 decimals offset (`_decimalsOffset`) plus governance is
///      expected to seed a small dead-share deposit right after deploy.
contract TMUSDVault is ERC4626, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 internal constant DECIMALS_OFFSET = 6;

    address public loanManager;
    address public liquidator;
    IMUSDSavingsRate public msr;

    uint256 public totalLent;
    uint256 public badDebtProvision;

    struct RedeemRequest {
        address owner;
        address receiver;
        uint256 shares;
        uint256 assetsAtRequest;
        bool fulfilled;
    }

    RedeemRequest[] public queue;
    uint256 public queueHead;

    event LoanManagerSet(address indexed loanManager);
    event LiquidatorSet(address indexed liquidator);
    event MSRSet(address indexed msr);
    event Lent(address indexed to, uint256 amount);
    event RepaymentReceived(uint256 amount);
    event BadDebtRealized(uint256 amount);
    event ParkedInMSR(uint256 amount);
    event PulledFromMSR(uint256 amount);
    event RedeemRequested(
        uint256 indexed requestId, address indexed owner, address indexed receiver, uint256 shares, uint256 assets
    );
    event RedeemFulfilled(uint256 indexed requestId, address indexed receiver, uint256 assets);

    error NotLoanManager();
    error NotLoanManagerOrLiquidator();
    error InsufficientLiquidity();

    constructor(IERC20 musd, address initialOwner) ERC20("Thaw MUSD", "tMUSD") ERC4626(musd) Ownable(initialOwner) { }

    modifier onlyLoanManager() {
        if (msg.sender != loanManager) revert NotLoanManager();
        _;
    }

    modifier onlyLoanManagerOrLiquidator() {
        if (msg.sender != loanManager && msg.sender != liquidator) revert NotLoanManagerOrLiquidator();
        _;
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    // --- wiring ---

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
        emit LoanManagerSet(_loanManager);
    }

    function setLiquidator(address _liquidator) external onlyOwner {
        liquidator = _liquidator;
        emit LiquidatorSet(_liquidator);
    }

    function setMSR(address _msr) external onlyOwner {
        msr = IMUSDSavingsRate(_msr);
        emit MSRSet(_msr);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- accounting ---

    /// @dev `totalLent` already excludes realized bad debt (realizeBadDebt writes it down), so the
    ///      share-price haircut happens here automatically the moment that happens. `badDebtProvision`
    ///      is kept only as a cumulative reporting counter (§14 Transparency screen) and must NOT be
    ///      subtracted again here — doing so would double-count the same loss.
    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 inMsr = address(msr) == address(0) ? 0 : msr.convertToAssets(msr.balanceOf(address(this)));
        return idle + inMsr + totalLent;
    }

    function idleLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    // --- LoanManager integration ---

    function lendToLoanManager(uint256 amount) external onlyLoanManager nonReentrant whenNotPaused {
        uint256 idle = idleLiquidity();
        if (idle < amount) {
            uint256 shortfall = amount - idle;
            _pullFromMSR(shortfall);
            idle = idleLiquidity();
        }
        if (idle < amount) revert InsufficientLiquidity();
        totalLent += amount;
        IERC20(asset()).safeTransfer(loanManager, amount);
        emit Lent(loanManager, amount);
    }

    /// @notice Pulls `amount` MUSD from the LoanManager (which must have approved this vault) and
    ///         records it as a repayment against `totalLent`.
    function receiveRepayment(uint256 amount) external onlyLoanManager nonReentrant {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        totalLent = amount >= totalLent ? 0 : totalLent - amount;
        emit RepaymentReceived(amount);
    }

    function realizeBadDebt(uint256 amount) external onlyLoanManagerOrLiquidator {
        totalLent = amount >= totalLent ? 0 : totalLent - amount;
        badDebtProvision += amount;
        emit BadDebtRealized(amount);
    }

    // --- MSR liquidity management ---

    function parkInMSR(uint256 amount) external onlyOwner {
        _parkInMSR(amount);
    }

    function pullFromMSR(uint256 amount) external onlyOwner {
        _pullFromMSR(amount);
    }

    function _parkInMSR(uint256 amount) internal {
        if (address(msr) == address(0) || amount == 0) return;
        IERC20(asset()).forceApprove(address(msr), amount);
        msr.deposit(amount, address(this));
        emit ParkedInMSR(amount);
    }

    function _pullFromMSR(uint256 amount) internal {
        if (address(msr) == address(0) || amount == 0) return;
        uint256 avail = msr.maxWithdraw(address(this));
        uint256 toPull = amount > avail ? avail : amount;
        if (toPull == 0) return;
        msr.withdraw(toPull, address(this), address(this));
        emit PulledFromMSR(toPull);
    }

    // --- instant liquidity caps on the standard ERC4626 path ---

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 standard = super.maxWithdraw(owner);
        uint256 idle = idleLiquidity();
        return standard > idle ? idle : standard;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 idle = idleLiquidity();
        uint256 idleShares = previewWithdraw(idle);
        uint256 standard = super.maxRedeem(owner);
        return standard > idleShares ? idleShares : standard;
    }

    // --- async redeem queue for withdrawals beyond idle liquidity (§12) ---

    function requestRedeem(uint256 shares, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 requestId)
    {
        uint256 assets = previewRedeem(shares);
        _transfer(msg.sender, address(this), shares);
        requestId = queue.length;
        queue.push(
            RedeemRequest({
                owner: msg.sender, receiver: receiver, shares: shares, assetsAtRequest: assets, fulfilled: false
            })
        );
        emit RedeemRequested(requestId, msg.sender, receiver, shares, assets);
    }

    /// @notice Pays out queued requests FIFO from current idle liquidity. Callable by anyone
    ///         (typically the keeper, right after a harvest inflow).
    function processQueue(uint256 maxRequests) external nonReentrant {
        uint256 processed = 0;
        while (queueHead < queue.length && processed < maxRequests) {
            RedeemRequest storage req = queue[queueHead];
            uint256 idle = idleLiquidity();
            if (idle < req.assetsAtRequest) break;
            req.fulfilled = true;
            _burn(address(this), req.shares);
            IERC20(asset()).safeTransfer(req.receiver, req.assetsAtRequest);
            emit RedeemFulfilled(queueHead, req.receiver, req.assetsAtRequest);
            queueHead++;
            processed++;
        }
    }

    function pendingQueueLength() external view returns (uint256) {
        return queue.length - queueHead;
    }
}
