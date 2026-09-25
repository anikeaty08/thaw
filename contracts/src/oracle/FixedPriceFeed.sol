// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPriceFeed } from "../interfaces/IPriceFeed.sol";

/// @title FixedPriceFeed
/// @notice Constant-price Chainlink-shaped feed for testnet deployments that use a mock MUSD. It
///         reports `updatedAt = block.timestamp`, so OracleRouter's staleness check always passes.
///         Never wire this to a real asset.
contract FixedPriceFeed is IPriceFeed {
    uint8 public immutable override decimals;
    int256 public immutable answer;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}
