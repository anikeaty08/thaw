// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ThawFaucet } from "../../src/testnet/ThawFaucet.sol";
import { MockVeAdapter } from "../../src/adapters/MockVeAdapter.sol";
import { MockVotingEscrow } from "../../src/adapters/mocks/MockVotingEscrow.sol";
import { MockRewardToken } from "../../src/adapters/mocks/MockRewardToken.sol";

contract ThawFaucetTest is Test {
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    MockRewardToken internal musd;
    MockVotingEscrow internal ve;
    MockVeAdapter internal adapter;
    ThawFaucet internal faucet;

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.startPrank(owner);
        musd = new MockRewardToken("Mock MUSD", "mUSD", owner);
        ve = new MockVotingEscrow("veNFT", "ve", owner);
        adapter = new MockVeAdapter(owner, address(ve), address(musd));
        faucet = new ThawFaucet(owner, IERC20(address(musd)), ve, adapter);
        musd.mint(address(faucet), 10_000e18);
        ve.transferOwnership(address(faucet));
        adapter.transferOwnership(address(faucet));
        vm.stopPrank();
    }

    function test_drip_sendsMusdAndMintsConfiguredLock() public {
        vm.prank(alice);
        uint256 tokenId = faucet.drip();

        assertEq(ve.ownerOf(tokenId), alice);
        assertEq(musd.balanceOf(alice), 1_000e18);
        assertEq(adapter.weeklyReward(tokenId), 60e18);
        assertEq(adapter.collateralValueUSD(tokenId), 5_000e18);
    }

    function test_drip_enforcesCooldown() public {
        vm.startPrank(alice);
        faucet.drip();
        vm.expectRevert(abi.encodeWithSelector(ThawFaucet.CoolingDown.selector, block.timestamp + 1 days));
        faucet.drip();

        vm.warp(block.timestamp + 1 days);
        faucet.drip();
        vm.stopPrank();
        assertEq(musd.balanceOf(alice), 2_000e18);
    }

    function test_drip_stillMintsLockWhenMusdRunsDry() public {
        vm.prank(owner);
        faucet.setDripConfig(20_000e18, 60e18, 5_000e18, 1 days);

        vm.prank(alice);
        uint256 tokenId = faucet.drip();
        assertEq(musd.balanceOf(alice), 10_000e18);
        assertEq(ve.ownerOf(tokenId), alice);
    }

    function test_execute_onlyOwner_andForwardsAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        faucet.execute(address(adapter), abi.encodeCall(MockVeAdapter.setWeeklyReward, (1, 1)));

        vm.prank(owner);
        faucet.execute(address(adapter), abi.encodeCall(MockVeAdapter.setWeeklyReward, (7, 42e18)));
        assertEq(adapter.weeklyReward(7), 42e18);
    }
}
