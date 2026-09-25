// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Mezo Pools Router surface used by the Harvester to swap claimed reward tokens into MUSD.
///         Verified against `IRouter` in mezo-org/tigris (Solidly/Velodrome-v2-style router).
interface IRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }

    function getAmountsOut(uint256 amountIn, Route[] memory routes) external view returns (uint256[] memory amounts);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
