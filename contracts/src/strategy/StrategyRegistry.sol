// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStrategyRegistry } from "../interfaces/IStrategyRegistry.sol";
import { IVoter } from "../interfaces/IVoter.sol";

/// @title StrategyRegistry
/// @notice Holds the default per-epoch vote strategy per adapter, posted by an off-chain optimizer
///         role. Keepers can only execute the registered strategy (§8.5, §10.3, §16 threat #5).
contract StrategyRegistry is IStrategyRegistry, Ownable {
    uint256 internal constant WEEK = 7 days;
    uint256 internal constant BPS = 1e4;

    address public optimizer;
    // adapter => voter contract used to check gauge liveness (adapter-specific, set by governance)
    mapping(address => address) public voterOf;

    mapping(address => Strategy) internal _strategies;

    error NotOptimizer();
    error LengthMismatch();
    error WeightsDontSumToOne();
    error GaugeNotAlive();

    constructor(address initialOwner) Ownable(initialOwner) { }

    modifier onlyOptimizer() {
        if (msg.sender != optimizer) revert NotOptimizer();
        _;
    }

    function setOptimizer(address _optimizer) external onlyOwner {
        optimizer = _optimizer;
    }

    function setVoterOf(address adapter, address voter) external onlyOwner {
        voterOf[adapter] = voter;
    }

    function postStrategy(address adapter, address[] calldata gauges, uint256[] calldata weights)
        external
        onlyOptimizer
    {
        if (gauges.length != weights.length || gauges.length == 0) revert LengthMismatch();

        uint256 sum;
        address voter = voterOf[adapter];
        for (uint256 i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (voter != address(0) && !IVoter(voter).isAlive(gauges[i])) revert GaugeNotAlive();
        }
        if (sum != BPS) revert WeightsDontSumToOne();

        Strategy storage s = _strategies[adapter];
        s.gauges = gauges;
        s.weights = weights;
        s.epoch = uint64(block.timestamp / WEEK);

        emit StrategyPosted(adapter, s.epoch, keccak256(abi.encode(gauges, weights)));
    }

    function currentStrategy(address adapter) external view returns (Strategy memory) {
        return _strategies[adapter];
    }

    function strategyHash(address adapter) external view returns (bytes32) {
        Strategy storage s = _strategies[adapter];
        return keccak256(abi.encode(s.gauges, s.weights));
    }
}
