// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Bribe / Fee reward contract surface (per-gauge), verified against `IReward` in mezo-org/tigris.
interface IReward {
    function earned(address token, uint256 tokenId) external view returns (uint256);

    function rewardsListLength() external view returns (uint256);

    function rewards(uint256 index) external view returns (address);

    function getReward(uint256 tokenId, address[] memory tokens) external;
}
