// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { MockVotingEscrow } from "./mocks/MockVotingEscrow.sol";
import { MockRewardToken } from "./mocks/MockRewardToken.sol";

/// @title MockVeAdapter
/// @notice Self-contained ve adapter for unit tests and the demo fallback if a real Mezo ve
///         deployment isn't reachable (§8.3, §22, §23). Rewards are configured per-tokenId by
///         governance/tests rather than pulled from a real Voter, and `claim` mints them directly.
contract MockVeAdapter is IVeAdapter, Ownable {
    MockVotingEscrow public ve;
    MockRewardToken public rewardToken;

    address public harvester;
    address public loanManager;

    mapping(uint256 => uint256) public weeklyReward; // configurable simulated income, MUSD-equivalent 1e18
    mapping(uint256 => uint256) public collateralValue; // configurable simulated USD value, 1e18

    error NotHarvester();
    error NotLoanManager();

    constructor(address initialOwner, address _ve, address _rewardToken) Ownable(initialOwner) {
        ve = MockVotingEscrow(_ve);
        rewardToken = MockRewardToken(_rewardToken);
    }

    modifier onlyHarvester() {
        if (msg.sender != harvester) revert NotHarvester();
        _;
    }

    modifier onlyLoanManager() {
        if (msg.sender != loanManager) revert NotLoanManager();
        _;
    }

    function setHarvester(address _harvester) external onlyOwner {
        harvester = _harvester;
    }

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    function setWeeklyReward(uint256 tokenId, uint256 amount) external onlyOwner {
        weeklyReward[tokenId] = amount;
    }

    function setCollateralValue(uint256 tokenId, uint256 valueUsd) external onlyOwner {
        collateralValue[tokenId] = valueUsd;
    }

    function escrowToken() external view returns (address) {
        return address(ve);
    }

    function vote(uint256 tokenId, bytes calldata) external onlyHarvester {
        ve.setVoted(tokenId, true);
    }

    function claim(uint256 tokenId) external onlyHarvester returns (address[] memory tokens, uint256[] memory amounts) {
        uint256 amount = weeklyReward[tokenId];
        tokens = new address[](1);
        amounts = new uint256[](1);
        tokens[0] = address(rewardToken);
        amounts[0] = amount;
        if (amount > 0) {
            rewardToken.mint(msg.sender, amount);
        }
    }

    function pendingRewards(uint256 tokenId) external view returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = new address[](1);
        amounts = new uint256[](1);
        tokens[0] = address(rewardToken);
        amounts[0] = weeklyReward[tokenId];
    }

    function collateralValueUSD(uint256 tokenId) external view returns (uint256) {
        return collateralValue[tokenId];
    }

    function unlockTime(uint256 tokenId) external view returns (uint256) {
        return ve.locked(tokenId).end;
    }

    function canRelease(uint256 tokenId) external view returns (bool) {
        return !ve.deactivated(tokenId) && !ve.voted(tokenId);
    }

    function prepareRelease(uint256 tokenId) external onlyLoanManager {
        ve.setVoted(tokenId, false);
    }
}
