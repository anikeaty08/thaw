// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPriceFeed } from "../../src/interfaces/IPriceFeed.sol";

contract MockPriceFeed is IPriceFeed {
    uint8 internal _decimals;
    int256 internal _answer;
    uint256 internal _updatedAt;

    constructor(uint8 dec, int256 initialAnswer) {
        _decimals = dec;
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
    }

    function set(int256 answer, uint256 updatedAt) external {
        _answer = answer;
        _updatedAt = updatedAt;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }
}
