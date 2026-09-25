// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TestBase } from "../TestBase.sol";

contract HarvesterTest is TestBase {
    function test_harvest_appliesToDebtAndPaysBountyAndFee() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);

        // Land inside the next epoch so harvest() doesn't collide with the loan-open epoch.
        vm.warp(block.timestamp + 7 days);

        uint256 keeperBalBefore = musd.balanceOf(keeper);
        uint256 reserveBalBefore = musd.balanceOf(address(reserveFund));
        uint256 debtBefore = loanManager.debtOf(loanId);

        vm.prank(keeper);
        uint256 musdIn = harvester.harvest(loanId);

        assertEq(musdIn, 42e18, "full weekly reward claimed");

        uint256 bounty = (42e18 * 50) / BPS; // 0.5%
        uint256 fee = (42e18 * 1000) / BPS; // 10% protocol fee
        assertEq(musd.balanceOf(keeper) - keeperBalBefore, bounty, "keeper bounty paid");
        assertEq(musd.balanceOf(address(reserveFund)) - reserveBalBefore, fee, "protocol fee paid");

        uint256 remaining = 42e18 - bounty - fee;
        uint256 debtAfter = loanManager.debtOf(loanId);
        assertApproxEqAbs(debtBefore - debtAfter, remaining, 1e12, "full remainder (100% repay share) applied to debt");
    }

    function test_harvest_revertsIfAlreadyHarvestedThisEpoch() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 10000);
        vm.warp(block.timestamp + 7 days);

        harvester.harvest(loanId);
        vm.expectRevert();
        harvester.harvest(loanId);
    }

    function test_harvest_surplusGoesToBorrowerWhenRepayShareBelow100() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 42e18, 100e18, 5000); // 50% repay share
        vm.warp(block.timestamp + 7 days);

        uint256 borrowerBalBefore = musd.balanceOf(borrower);
        harvester.harvest(loanId);

        uint256 bounty = (42e18 * 50) / BPS;
        uint256 fee = (42e18 * 1000) / BPS;
        uint256 remaining = 42e18 - bounty - fee;
        uint256 expectedSurplus = remaining - (remaining * 5000) / BPS;

        assertEq(musd.balanceOf(borrower) - borrowerBalBefore, expectedSurplus, "50% surplus paid to borrower");
    }

    function test_harvestMany_isolatesFailures() public {
        uint256 tokenId1 = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId1 = _openAdvanceLoan(tokenId1, 42e18, 100e18, 10000);
        vm.warp(block.timestamp + 7 days);

        uint256[] memory loanIds = new uint256[](2);
        loanIds[0] = loanId1;
        loanIds[1] = 9999; // nonexistent loan; must not revert the whole batch

        uint256 succeeded = harvester.harvestMany(loanIds);
        assertEq(succeeded, 1, "only the valid loan succeeds");
    }

    function test_missedEpochs_incrementOnZeroIncomeHarvest() public {
        uint256 tokenId = _mintVeNFT(borrower, 100_000e18, block.timestamp + 4 * 365 days, false);
        uint256 loanId = _openAdvanceLoan(tokenId, 10e18, 1e18, 10000); // tiny loan, opened against a small reward
        vm.prank(governance);
        mockAdapter.setWeeklyReward(tokenId, 0); // rewards dry up after open

        vm.warp(block.timestamp + 7 days);
        harvester.harvest(loanId);

        assertEq(loanManager.healthFactor(loanId), type(uint256).max, "still non-liquidating before 8 misses");
    }
}
