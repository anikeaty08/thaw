// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { TestBase } from "../TestBase.sol";

contract TMUSDVaultTest is TestBase {
    function test_deposit_mintsShares() public {
        address alice = makeAddr("alice");
        musd.mint(alice, 100e18);
        vm.startPrank(alice);
        musd.approve(address(vault), 100e18);
        uint256 shares = vault.deposit(100e18, alice);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
    }

    function test_lendToLoanManager_pullsFromMSRWhenIdleInsufficient() public {
        // Drain idle liquidity into the MSR, then borrow more than idle alone can cover.
        vm.prank(governance);
        vault.parkInMSR(900_000e18);

        assertEq(vault.idleLiquidity(), 100_000e18);

        vm.prank(address(loanManager));
        vault.lendToLoanManager(150_000e18); // must pull 50,000 back from the MSR

        assertEq(musd.balanceOf(address(loanManager)), 150_000e18);
    }

    function test_withdraw_capsAtIdleLiquidity() public {
        vm.prank(governance);
        vault.parkInMSR(950_000e18);
        // idle liquidity is now 50,000; lp holds shares worth 1,000,000.
        uint256 maxW = vault.maxWithdraw(lp);
        assertEq(maxW, 50_000e18);
    }

    function test_requestRedeemAndProcessQueue() public {
        vm.prank(governance);
        vault.parkInMSR(950_000e18); // idle = 50,000

        uint256 shares = vault.balanceOf(lp);
        vm.prank(lp);
        vault.requestRedeem(shares, lp);

        // Not enough idle liquidity yet to fulfill the whole request.
        vault.processQueue(10);
        assertEq(vault.pendingQueueLength(), 1);

        // Simulate a harvest inflow repaying the vault, then fulfill.
        vm.prank(governance);
        vault.pullFromMSR(950_000e18);
        vault.processQueue(10);

        assertEq(vault.pendingQueueLength(), 0);
        assertEq(musd.balanceOf(lp), 1_000_000e18);
    }

    function test_realizeBadDebt_reducesTotalAssets() public {
        uint256 before = vault.totalAssets();
        vm.prank(address(loanManager));
        vault.lendToLoanManager(100e18);

        vm.prank(address(liquidator));
        vault.realizeBadDebt(40e18);

        assertEq(vault.totalAssets(), before - 40e18);
    }
}
