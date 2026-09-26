// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Weekly harvest pipeline: claim -> swap -> split (bounty/fee/debt/surplus) -> re-vote.
///         See docs/THAW_SYSTEM_DESIGN.md §8.4.
interface IHarvester {
    event Harvested(
        uint256 indexed loanId,
        uint256 indexed epoch,
        uint256 musdIn,
        uint256 toDebt,
        uint256 fee,
        uint256 surplus,
        uint256 bounty
    );
    event Voted(uint256 indexed loanId, uint256 indexed epoch);
    event SwapExecuted(address indexed tokenIn, uint256 amountIn, uint256 musdOut);
    event SwapSkipped(address indexed tokenIn, uint256 amountIn);

    function harvest(uint256 loanId) external returns (uint256 musdIn);

    function harvestMany(uint256[] calldata loanIds) external returns (uint256 succeeded);

    function epochOf(uint256 timestamp) external pure returns (uint256);

    function lastHarvestEpoch(uint256 loanId) external view returns (uint256);
}
