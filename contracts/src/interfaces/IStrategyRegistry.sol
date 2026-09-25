// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Holds the per-epoch, per-adapter default vote strategy posted by the optimizer role.
///         See docs/THAW_SYSTEM_DESIGN.md §8.5 and §10.3.
interface IStrategyRegistry {
    struct Strategy {
        address[] gauges;
        uint256[] weights; // must sum to 1e4 (bps) or 1e18 depending on adapter convention; adapters decide
        uint64 epoch;
    }

    event StrategyPosted(address indexed adapter, uint64 indexed epoch, bytes32 strategyHash);

    function postStrategy(address adapter, address[] calldata gauges, uint256[] calldata weights) external;

    function currentStrategy(address adapter) external view returns (Strategy memory);

    function strategyHash(address adapter) external view returns (bytes32);
}
