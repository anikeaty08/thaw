// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";
import { IPriceFeed } from "../interfaces/IPriceFeed.sol";
import { IRouter } from "../interfaces/IRouter.sol";

/// @title OracleRouter
/// @notice Primary Chainlink-style feed per token with a Mezo-Pools TWAP-style fallback and a
///         deviation guard, per docs/THAW_SYSTEM_DESIGN.md §9.4. All prices are 1e18-scaled USD
///         and all priced tokens are assumed 18-decimal (true of MUSD/MEZO/WBTC-style wrappers on
///         Mezo); a token with different decimals needs a wrapped adapter, not a config change here.
contract OracleRouter is IOracleRouter, Ownable {
    uint256 internal constant WAD = 1e18;

    struct FeedConfig {
        IPriceFeed primary; // address(0) if none configured
        uint256 maxStaleness; // seconds
        uint256 maxDeviationBps; // vs fallback quote, e.g. 500 = 5%
        IRouter.Route[] fallbackRoute; // path to MUSD via the Mezo router, for a pool quote
        bool configured;
    }

    IRouter public router;
    address public musd;
    uint256 public musdDepegThresholdWad = 0.97e18; // §9.4: pause new borrows if pool MUSD < $0.97
    IRouter.Route[] internal _musdProbeRoute; // MUSD -> reference stable route used to check the peg

    mapping(address => FeedConfig) internal _feeds;

    event RouterSet(address indexed router);
    event MUSDSet(address indexed musd);
    event FeedConfigured(address indexed token, address primary, uint256 maxStaleness, uint256 maxDeviationBps);

    error NoFeedConfigured();

    constructor(address initialOwner, address _router, address _musd) Ownable(initialOwner) {
        router = IRouter(_router);
        musd = _musd;
    }

    function setRouter(address _router) external onlyOwner {
        router = IRouter(_router);
        emit RouterSet(_router);
    }

    function setMUSD(address _musd) external onlyOwner {
        musd = _musd;
        emit MUSDSet(_musd);
    }

    function setMUSDDepegThreshold(uint256 thresholdWad) external onlyOwner {
        musdDepegThresholdWad = thresholdWad;
    }

    function setMUSDProbeRoute(IRouter.Route[] calldata route) external onlyOwner {
        delete _musdProbeRoute;
        for (uint256 i = 0; i < route.length; i++) {
            _musdProbeRoute.push(route[i]);
        }
    }

    function configureFeed(
        address token,
        address primary,
        uint256 maxStaleness,
        uint256 maxDeviationBps,
        IRouter.Route[] calldata fallbackRoute
    ) external onlyOwner {
        FeedConfig storage cfg = _feeds[token];
        cfg.primary = IPriceFeed(primary);
        cfg.maxStaleness = maxStaleness;
        cfg.maxDeviationBps = maxDeviationBps;
        cfg.configured = true;
        delete cfg.fallbackRoute;
        for (uint256 i = 0; i < fallbackRoute.length; i++) {
            cfg.fallbackRoute.push(fallbackRoute[i]);
        }
        emit FeedConfigured(token, primary, maxStaleness, maxDeviationBps);
    }

    function getPriceUSD(address token) external view returns (uint256 price, bool stale) {
        FeedConfig storage cfg = _feeds[token];
        if (!cfg.configured) revert NoFeedConfigured();

        uint256 primaryPrice;
        bool primaryOk;
        if (address(cfg.primary) != address(0)) {
            (primaryPrice, primaryOk) = _readPrimary(cfg.primary, cfg.maxStaleness);
        }

        uint256 fallbackPrice;
        bool fallbackOk;
        if (cfg.fallbackRoute.length > 0) {
            (fallbackPrice, fallbackOk) = _readFallback(cfg.fallbackRoute);
        }

        if (primaryOk && fallbackOk) {
            uint256 deviation = _deviationBps(primaryPrice, fallbackPrice);
            if (deviation > cfg.maxDeviationBps) {
                // Disagreement between sources: surface the primary but flag as stale/untrusted.
                return (primaryPrice, true);
            }
            return (primaryPrice, false);
        }
        if (primaryOk) return (primaryPrice, false);
        if (fallbackOk) return (fallbackPrice, true);
        return (0, true);
    }

    function isMUSDDepegged() external view returns (bool) {
        if (_musdProbeRoute.length == 0) return false;
        (uint256 price, bool ok) = _readFallback(_musdProbeRoute);
        if (!ok) return false;
        return price < musdDepegThresholdWad;
    }

    function _readPrimary(IPriceFeed feed, uint256 maxStaleness) internal view returns (uint256 price, bool ok) {
        try feed.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0) return (0, false);
            if (block.timestamp - updatedAt > maxStaleness) return (0, false);
            uint8 dec = feed.decimals();
            price = dec == 18 ? uint256(answer) : uint256(answer) * (10 ** (18 - dec));
            ok = true;
        } catch {
            return (0, false);
        }
    }

    function _readFallback(IRouter.Route[] memory route) internal view returns (uint256 price, bool ok) {
        if (address(router) == address(0) || route.length == 0) return (0, false);
        try router.getAmountsOut(WAD, route) returns (uint256[] memory amounts) {
            if (amounts.length == 0) return (0, false);
            // Route terminates in MUSD (~$1), so the last amount out per 1e18 in is the USD price.
            price = amounts[amounts.length - 1];
            ok = price > 0;
        } catch {
            return (0, false);
        }
    }

    function _deviationBps(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == b) return 0;
        uint256 diff = a > b ? a - b : b - a;
        uint256 base = a > b ? b : a;
        if (base == 0) return type(uint256).max;
        return (diff * 1e4) / base;
    }
}
