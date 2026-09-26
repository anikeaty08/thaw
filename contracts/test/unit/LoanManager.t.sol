// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TestBase } from "../TestBase.sol";
import { Mode, Loan } from "../../src/interfaces/ILoanManager.sol";

contract LoanManagerTest is TestBase {
    function test_openAdvanceLoan_transfersNFTAndMUSD() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 200e18, 10000);

        assertEq(musd.balanceOf(borrower), 200e18, "borrower receives MUSD");
        assertTrue(escrow.isHeld(address(mockVE), tokenId), "NFT held in escrow");
        assertEq(positionNFT.ownerOf(loanId), borrower, "borrower holds position NFT");

        Loan memory loan = loanManager.getLoan(loanId);
        assertEq(loan.principal, 200e18);
        assertEq(uint8(loan.mode), uint8(Mode.Advance));
    }

    function test_openLoan_revertsAboveMaxBorrow() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        vm.prank(governance);
        mockAdapter.setWeeklyReward(tokenId, 42e18);
        vm.prank(borrower);
        mockVE.approve(address(escrow), tokenId);

        // bootstrap cap = 42e18 * 0.8 * 0.75 * 10 = 252e18
        vm.prank(borrower);
        vm.expectRevert();
        loanManager.openLoan(address(mockAdapter), tokenId, Mode.Advance, 300e18, 10000);
    }

    function test_repay_reducesDebtAndAcceptsOverpaymentCapped() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        musd.mint(borrower, 1000e18);
        uint256 balBefore = musd.balanceOf(borrower); // includes the 100e18 borrowed earlier + the 1000e18 just minted
        vm.startPrank(borrower);
        musd.approve(address(loanManager), type(uint256).max);
        loanManager.repay(loanId, 1000e18); // way more than the 100e18 debt
        vm.stopPrank();

        assertEq(loanManager.debtOf(loanId), 0, "debt fully repaid");
        assertEq(musd.balanceOf(borrower), balBefore - 100e18, "only the debt amount was pulled");
    }

    function test_closeLoan_returnsNFTOnceDebtZero() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        musd.mint(borrower, 100e18);
        vm.startPrank(borrower);
        musd.approve(address(loanManager), type(uint256).max);
        loanManager.repay(loanId, 100e18);
        loanManager.closeLoan(loanId);
        vm.stopPrank();

        assertEq(mockVE.ownerOf(tokenId), borrower, "NFT returned to borrower");
        assertFalse(escrow.isHeld(address(mockVE), tokenId));
    }

    function test_closeLoan_revertsIfDebtOutstanding() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        vm.prank(borrower);
        vm.expectRevert();
        loanManager.closeLoan(loanId);
    }

    function test_interestAccrues_overTime() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        uint256 debtAtOpen = loanManager.debtOf(loanId);
        vm.warp(block.timestamp + 365 days);
        uint256 debtOneYearLater = loanManager.debtOf(loanId);

        // 6% simple APR on 100 MUSD over 1 year ~= 106 MUSD
        assertApproxEqAbs(debtOneYearLater, 106e18, 1e15);
        assertGt(debtOneYearLater, debtAtOpen);
    }

    function test_borrowMore_withinHeadroom() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        vm.prank(borrower);
        loanManager.borrowMore(loanId, 50e18);

        assertEq(loanManager.debtOf(loanId), 150e18);
        assertEq(musd.balanceOf(borrower), 150e18);
    }

    function test_setRepayShare_onlyBorrower() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        loanManager.setRepayShare(loanId, 9000);

        vm.prank(borrower);
        loanManager.setRepayShare(loanId, 9000);
    }
}
