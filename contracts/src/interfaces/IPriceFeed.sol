// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Chainlink-style aggregator interface, the shape Mezo's MUSD `PriceFeed` and most
///         BTC/USD and MEZO/USD feeds on Mezo are expected to expose. See docs §9.4.
interface IPriceFeed {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
