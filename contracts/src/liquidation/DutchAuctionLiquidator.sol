// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Loan } from "../interfaces/ILoanManager.sol";
import { IThawEscrow } from "../interfaces/IThawEscrow.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { ILenderVault } from "../interfaces/ILenderVault.sol";
import { LoanManager } from "../core/LoanManager.sol";
import { ReserveFund } from "./ReserveFund.sol";

/// @title DutchAuctionLiquidator
/// @notice Runs a 24h linear Dutch auction for a defaulted veNFT, with a ReserveFund backstop at
///         the floor and bad-debt socialization if the reserve can't cover it. See docs §11.2.
contract DutchAuctionLiquidator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;
    uint256 internal constant START_PRICE_BPS = 9500; // 0.95 * V_spot
    uint256 internal constant FLOOR_VALUE_BPS = 4000; // 0.40 * V_spot floor component
    uint256 internal constant PENALTY_BPS = 200; // 2% of proceeds -> ReserveFund
    uint256 internal constant AUCTION_DURATION = 24 hours;

    struct Auction {
        address adapter;
        uint256 tokenId;
        uint256 startPrice;
        uint256 floorPrice;
        uint256 startTime;
        bool active;
        bool settled;
    }

    LoanManager public loanManager;
    IThawEscrow public escrow;
    ILenderVault public vault;
    ReserveFund public reserveFund;
    IERC20 public musd;

    mapping(uint256 => Auction) public auctions;

    event AuctionStarted(
        uint256 indexed loanId, address indexed adapter, uint256 tokenId, uint256 startPrice, uint256 floorPrice
    );
    event AuctionSettled(
        uint256 indexed loanId,
        address indexed buyer,
        uint256 price,
        uint256 debtPortion,
        uint256 penalty,
        uint256 borrowerAmount,
        uint256 badDebt
    );

    error NotUnderwater();
    error AlreadyLiquidating();
    error AuctionNotActive();
    error AuctionStillLive();
    error AlreadySettled();

    constructor(
        address initialOwner,
        address _loanManager,
        address _escrow,
        address _vault,
        address _reserveFund,
        address _musd
    ) Ownable(initialOwner) {
        loanManager = LoanManager(_loanManager);
        escrow = IThawEscrow(_escrow);
        vault = ILenderVault(_vault);
        reserveFund = ReserveFund(_reserveFund);
        musd = IERC20(_musd);
    }

    /// @notice Permissionless: any keeper may start an auction once the loan is underwater
    ///         (§10.2: "calls startAuction when HF < 1").
    function checkAndStartAuction(uint256 loanId) external {
        if (loanManager.healthFactor(loanId) >= WAD) revert NotUnderwater();
        _startAuction(loanId);
    }

    function _startAuction(uint256 loanId) internal {
        Loan memory loan = loanManager.getLoan(loanId);
        if (loan.liquidating || loan.closed) revert AlreadyLiquidating();

        uint256 vSpot = IVeAdapter(loan.adapter).collateralValueUSD(loan.tokenId);
        uint256 debt = loanManager.debtOf(loanId);

        uint256 startPrice = (vSpot * START_PRICE_BPS) / BPS;
        uint256 floorFromValue = (vSpot * FLOOR_VALUE_BPS) / BPS;
        uint256 floorPrice = debt > floorFromValue ? debt : floorFromValue;
        if (floorPrice > startPrice) startPrice = floorPrice;

        loanManager.markLiquidating(loanId);

        address nft = IVeAdapter(loan.adapter).escrowToken();
        escrow.release(nft, address(this), loan.tokenId);

        auctions[loanId] = Auction({
            adapter: loan.adapter,
            tokenId: loan.tokenId,
            startPrice: startPrice,
            floorPrice: floorPrice,
            startTime: block.timestamp,
            active: true,
            settled: false
        });

        emit AuctionStarted(loanId, loan.adapter, loan.tokenId, startPrice, floorPrice);
    }

    function currentPrice(uint256 loanId) public view returns (uint256) {
        Auction memory a = auctions[loanId];
        if (!a.active) return 0;
        uint256 elapsed = block.timestamp - a.startTime;
        if (elapsed >= AUCTION_DURATION) return a.floorPrice;
        uint256 drop = ((a.startPrice - a.floorPrice) * elapsed) / AUCTION_DURATION;
        return a.startPrice - drop;
    }

    /// @notice Anyone may buy the collateral at the current decayed price, at any time while the
    ///         auction is active (price simply holds at the floor after 24h, so a late buyer can
    ///         still clear it — §16 threat #13).
    function buy(uint256 loanId) external nonReentrant {
        Auction storage a = auctions[loanId];
        if (!a.active) revert AuctionNotActive();
        uint256 price = currentPrice(loanId);
        musd.safeTransferFrom(msg.sender, address(this), price);
        _settle(loanId, a, price, msg.sender);
    }

    /// @notice Backstop: once the 24h window has elapsed with no buyer, the ReserveFund buys at
    ///         the floor. Whatever the reserve can't cover is socialized to tMUSD (§11.2).
    function settleWithReserve(uint256 loanId) external nonReentrant onlyOwner {
        Auction storage a = auctions[loanId];
        if (!a.active) revert AuctionNotActive();
        if (block.timestamp - a.startTime < AUCTION_DURATION) revert AuctionStillLive();

        uint256 floor = a.floorPrice;
        uint256 reserveBal = reserveFund.balance();
        uint256 price = reserveBal < floor ? reserveBal : floor;
        if (price > 0) {
            reserveFund.withdrawTo(address(this), price);
        }
        _settle(loanId, a, price, address(reserveFund));
    }

    function _settle(uint256 loanId, Auction storage a, uint256 price, address nftRecipient) internal {
        if (a.settled) revert AlreadySettled();
        a.settled = true;
        a.active = false;

        uint256 debt = loanManager.debtOf(loanId);
        uint256 debtPortion = price > debt ? debt : price;
        uint256 remainder = price - debtPortion;
        uint256 penalty = (price * PENALTY_BPS) / BPS;
        if (penalty > remainder) penalty = remainder;
        uint256 borrowerAmount = remainder - penalty;

        if (debtPortion > 0) {
            musd.forceApprove(address(loanManager), debtPortion);
            loanManager.repay(loanId, debtPortion);
        }
        if (penalty > 0) {
            musd.safeTransfer(address(reserveFund), penalty);
        }

        address nft = IVeAdapter(a.adapter).escrowToken();
        _releaseNFT(nft, nftRecipient, a.tokenId);

        uint256 badDebt = debt - debtPortion;
        if (badDebt > 0) {
            vault.realizeBadDebt(badDebt);
        }

        uint256 borrowerPaid = 0;
        if (borrowerAmount > 0) {
            address borrower = _positionOwnerSafe(loanId);
            if (borrower != address(0)) {
                musd.safeTransfer(borrower, borrowerAmount);
                borrowerPaid = borrowerAmount;
            } else {
                // PositionNFT already burned or nonexistent: surplus goes to the reserve rather than being stuck.
                musd.safeTransfer(address(reserveFund), borrowerAmount);
            }
        }

        loanManager.closeLiquidatedLoan(loanId);

        emit AuctionSettled(loanId, nftRecipient, price, debtPortion, penalty, borrowerPaid, badDebt);
    }

    function _releaseNFT(address nft, address to, uint256 tokenId) internal {
        // The Liquidator already holds the NFT (pulled at auction start); transfer it directly.
        (bool ok,) =
            nft.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", address(this), to, tokenId));
        require(ok, "DutchAuctionLiquidator: nft transfer failed");
    }

    function _positionOwnerSafe(uint256 loanId) internal view returns (address) {
        try loanManager.positionNFT().ownerOf(loanId) returns (address owner_) {
            return owner_;
        } catch {
            return address(0);
        }
    }

    function getAuction(uint256 loanId) external view returns (Auction memory) {
        return auctions[loanId];
    }
}
