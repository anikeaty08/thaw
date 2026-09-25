// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IVoter } from "../../src/interfaces/IVoter.sol";
import { MockReward } from "./MockReward.sol";
import { MockVotingEscrow } from "../../src/adapters/mocks/MockVotingEscrow.sol";

/// @notice Test double for the Mezo Voter / boost-voter. Pays out claims via MockReward.payout,
///         with `msg.sender` at claim time (the ThawEscrow, calling through `execute`) as recipient,
///         mirroring how a real Solidly Reward contract pays the ve owner.
contract MockVoter is IVoter {
    MockVotingEscrow public ve;

    mapping(address => address) public gaugeToBribe;
    mapping(address => address) public gaugeToFees;
    mapping(address => bool) public gaugeAlive;
    mapping(uint256 => uint256) public lastVoted;
    mapping(uint256 => bool) public whitelisted;

    constructor(address _ve) {
        ve = MockVotingEscrow(_ve);
    }

    function setGauge(address gauge, address bribe, address fee, bool alive) external {
        gaugeToBribe[gauge] = bribe;
        gaugeToFees[gauge] = fee;
        gaugeAlive[gauge] = alive;
    }

    function setWhitelisted(uint256 tokenId, bool w) external {
        whitelisted[tokenId] = w;
    }

    function vote(uint256 tokenId, address[] calldata, uint256[] calldata) external {
        ve.setVoted(tokenId, true);
        lastVoted[tokenId] = block.timestamp;
    }

    function reset(uint256 tokenId) external {
        ve.setVoted(tokenId, false);
    }

    function poke(uint256) external { }

    function claimBribes(address[] memory bribes, address[][] memory tokens, uint256 tokenId) external {
        for (uint256 i = 0; i < bribes.length; i++) {
            if (bribes[i] == address(0)) continue;
            MockReward(bribes[i]).payout(tokenId, tokens[i], msg.sender);
        }
    }

    function claimFees(address[] memory fees, address[][] memory tokens, uint256 tokenId) external {
        for (uint256 i = 0; i < fees.length; i++) {
            if (fees[i] == address(0)) continue;
            MockReward(fees[i]).payout(tokenId, tokens[i], msg.sender);
        }
    }

    function gauges(address) external pure returns (address) {
        return address(0);
    }

    function isAlive(address gauge) external view returns (bool) {
        return gaugeAlive[gauge];
    }

    function isWhitelistedNFT(uint256 tokenId) external view returns (bool) {
        return whitelisted[tokenId];
    }

    function maxVotingNum() external pure returns (uint256) {
        return 10;
    }
}
