// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { ThawEscrow } from "../../src/core/ThawEscrow.sol";
import { VeBTCAdapter } from "../../src/adapters/VeBTCAdapter.sol";
import { OracleRouter } from "../../src/oracle/OracleRouter.sol";
import { MockVotingEscrow } from "../../src/adapters/mocks/MockVotingEscrow.sol";
import { IRouter } from "../../src/interfaces/IRouter.sol";

import { MockVoter } from "../mocks/MockVoter.sol";
import { MockReward } from "../mocks/MockReward.sol";
import { MockRouter } from "../mocks/MockRouter.sol";
import { MockPriceFeed } from "../mocks/MockPriceFeed.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";

/// @notice Exercises the real Solidly-shaped claim/vote path (SolidlyVeAdapter + ThawEscrow.execute)
///         against mock Voter/Reward contracts that mimic the tigris ABI (§6.3), independent of the
///         fast-path MockVeAdapter used by the rest of the unit suite.
contract VeBTCAdapterIntegrationTest is Test {
    address internal governance = makeAddr("governance");
    address internal harvesterRole = makeAddr("harvesterRole");
    address internal loanManagerRole = makeAddr("loanManagerRole");
    address internal borrower = makeAddr("borrower");

    ThawEscrow internal escrow;
    MockVotingEscrow internal ve;
    MockVoter internal voter;
    VeBTCAdapter internal adapter;
    OracleRouter internal oracleRouter;
    MockRouter internal router;
    MockERC20 internal bribeToken;
    MockReward internal bribe1;
    MockReward internal fee1;
    address internal gauge1 = makeAddr("gauge1");
    address internal btcToken = makeAddr("btcPriceToken");

    uint256 internal tokenId;

    function setUp() public {
        vm.startPrank(governance);

        router = new MockRouter();
        ve = new MockVotingEscrow("Mock veBTC", "mveBTC", governance);
        voter = new MockVoter(address(ve));
        ve.setVoterContract(address(voter));

        escrow = new ThawEscrow(governance);
        oracleRouter = new OracleRouter(governance, address(router), address(0));

        adapter =
            new VeBTCAdapter(governance, address(ve), address(escrow), address(voter), address(oracleRouter), btcToken);
        escrow.setAdapter(address(adapter), true);
        escrow.setAllowedTarget(address(voter), true);
        escrow.setLoanManager(loanManagerRole);
        adapter.setHarvester(harvesterRole);
        adapter.setLoanManager(loanManagerRole);

        bribeToken = new MockERC20("Bribe", "BRB");
        bribe1 = new MockReward();
        fee1 = new MockReward();
        voter.setGauge(gauge1, address(bribe1), address(fee1), true);

        MockPriceFeed btcFeed = new MockPriceFeed(18, int256(60_000e18));
        IRouter.Route[] memory emptyRoute = new IRouter.Route[](0);
        oracleRouter.configureFeed(btcToken, address(btcFeed), 365 days, 10_000, emptyRoute);

        vm.stopPrank();

        tokenId = _mintAndEscrow();
    }

    function _mintAndEscrow() internal returns (uint256 id) {
        vm.prank(governance);
        id = ve.mint(borrower, 2e18, block.timestamp + 20 days, false); // 2 BTC locked

        vm.prank(borrower);
        ve.approve(address(escrow), id);

        vm.prank(loanManagerRole);
        escrow.pull(address(ve), borrower, id);
    }

    function test_collateralValueUSD_appliesBtcDiscount() public view {
        // V = 2 BTC * $60,000 * 0.95 = 114,000
        uint256 v = adapter.collateralValueUSD(tokenId);
        assertEq(v, 114_000e18);
    }

    function test_vote_setsVotedOnVotingEscrow() public {
        address[] memory gauges = new address[](1);
        gauges[0] = gauge1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 10_000;

        vm.prank(harvesterRole);
        adapter.vote(tokenId, abi.encode(gauges, weights));

        assertTrue(ve.voted(tokenId));
    }

    function test_claim_sweepsBribeAndFeeTokensToHarvester() public {
        address[] memory gauges = new address[](1);
        gauges[0] = gauge1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 10_000;

        vm.prank(harvesterRole);
        adapter.vote(tokenId, abi.encode(gauges, weights));

        bribeToken.mint(address(bribe1), 100e18);
        bribe1.setReward(tokenId, address(bribeToken), 100e18);

        vm.prank(harvesterRole);
        (address[] memory tokens, uint256[] memory amounts) = adapter.claim(tokenId);

        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(bribeToken));
        assertEq(amounts[0], 100e18);
        assertEq(bribeToken.balanceOf(harvesterRole), 100e18, "reward swept all the way to the harvester");
        assertEq(bribeToken.balanceOf(address(escrow)), 0, "nothing left sitting in escrow");
    }

    function test_prepareRelease_resetsVoteBeforeWithdraw() public {
        address[] memory gauges = new address[](1);
        gauges[0] = gauge1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 10_000;

        vm.prank(harvesterRole);
        adapter.vote(tokenId, abi.encode(gauges, weights));
        assertTrue(ve.voted(tokenId));

        vm.prank(loanManagerRole);
        adapter.prepareRelease(tokenId);

        assertFalse(ve.voted(tokenId));
        assertTrue(adapter.canRelease(tokenId));
    }
}
