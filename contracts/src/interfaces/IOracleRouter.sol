// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Price feed abstraction with a primary oracle + TWAP fallback and deviation guards.
///         See docs/THAW_SYSTEM_DESIGN.md §9.4.
interface IOracleRouter {
    /// @return price 1e18-scaled USD price of `token`.
    /// @return stale whether the primary feed is stale/unavailable and the fallback was used or the
    ///         guard tripped (callers should treat `stale == true` as "pause new borrows for this asset").
    function getPriceUSD(address token) external view returns (uint256 price, bool stale);

    function isMUSDDepegged() external view returns (bool);
}
