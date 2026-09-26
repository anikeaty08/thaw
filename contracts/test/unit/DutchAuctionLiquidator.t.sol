// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TestBase } from "../TestBase.sol";
import { Mode } from "../../src/interfaces/ILoanManager.sol";

contract DutchAuctionLiquidatorTest is TestBase {
    function _openCreditLineLoan(uint256 tokenId, uint256 collateralValue, uint256 borrowAmount)
        internal
        returns (uint256 loanId)
    {
        vm.prank(governance);
        mockAdapter.setCollateralValue(tokenId, collateralValue);

        vm.prank(borrower);
        mockVE.approve(address(escrow), tokenId);

        vm.prank(borrower);
        loanId = loanManager.openLoan(address(mockAdapter), tokenId, Mode.CreditLine, borrowAmount, 10000);
    }

    function test_checkAndStartAuction_revertsIfHealthy() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openCreditLineLoan(tokenId, 10_000e18, 2_000e18);

        vm.expectRevert();
        liquidator.checkAndStartAuction(loanId);
    }

    function test_liquidation_fullFlow_buyerGetsNFTVaultGetsDebtSurplusToBorrower() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openCreditLineLoan(tokenId, 10_000e18, 2_500e18); // 25% LTV, at the cap

        // Collateral craters: HF = 3,000 * 0.40 / 2,500 = 0.48 < 1
        vm.prank(governance);
        mockAdapter.setCollateralValue(tokenId, 3_000e18);

        assertLt(loanManager.healthFactor(loanId), WAD);

        address buyer = makeAddr("buyer");
        musd.mint(buyer, 10_000e18);

        liquidator.checkAndStartAuction(loanId);
        assertTrue(loanManager.getLoan(loanId).liquidating);
        assertEq(escrow.isHeld(address(mockVE), tokenId), false, "NFT moved to liquidator custody");
        assertEq(mockVE.ownerOf(tokenId), address(liquidator));

        uint256 price = liquidator.currentPrice(loanId);
        uint256 debt = loanManager.debtOf(loanId);
        uint256 borrowerBalBefore = musd.balanceOf(borrower);
        uint256 vaultLentBefore = vault.totalLent();

        vm.startPrank(buyer);
        musd.approve(address(liquidator), price);
        liquidator.buy(loanId);
        vm.stopPrank();

        assertEq(mockVE.ownerOf(tokenId), buyer, "buyer receives the veNFT");
        assertEq(vault.totalLent(), vaultLentBefore - debt, "vault fully repaid (auction cleared above debt)");
        assertGt(musd.balanceOf(borrower), borrowerBalBefore, "borrower receives auction surplus");

        assertTrue(loanManager.getLoan(loanId).closed, "loan marked closed");
        vm.expectRevert();
        positionNFT.ownerOf(loanId); // position NFT burned on settlement
    }

    function test_settleWithReserve_usesBackstopAfter24h() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openCreditLineLoan(tokenId, 10_000e18, 2_500e18);

        vm.prank(governance);
        mockAdapter.setCollateralValue(tokenId, 3_000e18);

        liquidator.checkAndStartAuction(loanId);

        // Fund the reserve fully so it can cover the floor price without socializing bad debt.
        uint256 floorPrice = liquidator.getAuction(loanId).floorPrice;
        musd.mint(address(reserveFund), floorPrice);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(governance);
        liquidator.settleWithReserve(loanId);

        assertEq(mockVE.ownerOf(tokenId), address(reserveFund), "reserve fund backstops the auction");
        // floorPrice was fixed against the debt at auction-start; only the interest that accrued
        // during the 24h window (dust) can end up as bad debt, not the whole loan.
        assertApproxEqAbs(vault.totalLent(), 0, 1e18, "debt cleared, modulo 24h of interest drift");
        assertLt(vault.badDebtProvision(), 1e18, "at most a day of interest drift is socialized");
    }
}
