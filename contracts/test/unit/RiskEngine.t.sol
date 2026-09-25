// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TestBase } from "../TestBase.sol";
import { CollateralConfig, Mode } from "../../src/interfaces/ILoanManager.sol";

contract RiskEngineTest is TestBase {
    function test_maxAdvance_bootstrapAppliesExtraHaircut() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        vm.prank(governance);
        mockAdapter.setWeeklyReward(tokenId, 42e18);

        // bootstrap: 42 * 0.8 (extra haircut) * 0.75 (h) * 10 (k) = 252
        uint256 cap = riskEngine.maxAdvance(address(mockAdapter), tokenId);
        assertEq(cap, 252e18);
    }

    function test_maxAdvance_usesEMAAfterFirstHarvest() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        vm.warp(block.timestamp + 7 days);
        harvester.harvest(loanId);

        // history now exists; EMA bootstraps to the first sample (42e18) with no extra haircut.
        uint256 cap = riskEngine.maxAdvance(address(mockAdapter), tokenId);
        assertEq(cap, (42e18 * 7500 * 10) / 1e4);
    }

    function test_maxCreditLine_usesCollateralValue() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        vm.prank(governance);
        mockAdapter.setCollateralValue(tokenId, 10_000e18);

        uint256 cap = riskEngine.maxCreditLine(address(mockAdapter), tokenId);
        assertEq(cap, (10_000e18 * 2500) / 1e4); // 25% maxLtv
    }

    function test_healthFactorCreditLine_dropsAsDebtGrows() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        vm.prank(governance);
        mockAdapter.setCollateralValue(tokenId, 10_000e18);

        uint256 hfLowDebt = riskEngine.healthFactorCreditLine(address(mockAdapter), tokenId, 1_000e18);
        uint256 hfHighDebt = riskEngine.healthFactorCreditLine(address(mockAdapter), tokenId, 3_000e18);
        assertGt(hfLowDebt, hfHighDebt);

        // HF = V * liqLtv / debt = 10,000 * 0.40 / 3,000 = 1.333...
        assertApproxEqAbs(hfHighDebt, 1.333333333333333333e18, 1e9);
    }

    function test_debtCeiling_blocksBorrowBeyondCap() public {
        vm.prank(governance);
        riskEngine.setConfig(
            address(mockAdapter),
            CollateralConfig({
                enabled: true,
                advanceWeeks: 10,
                incomeHaircutBps: 7500,
                maxLtvBps: 2500,
                liqLtvBps: 4000,
                protocolFeeBps: 1000,
                debtCeiling: 200e18,
                totalBorrowed: 0
            })
        );

        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        vm.prank(governance);
        mockAdapter.setWeeklyReward(tokenId, 1000e18); // huge income so the ceiling, not the income cap, binds

        vm.prank(borrower);
        mockVE.approve(address(escrow), tokenId);

        vm.prank(borrower);
        vm.expectRevert();
        loanManager.openLoan(address(mockAdapter), tokenId, Mode.Advance, 300e18, 10000);
    }
}
