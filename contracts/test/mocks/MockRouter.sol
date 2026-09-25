// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRouter } from "../../src/interfaces/IRouter.sol";
import { MockERC20 } from "./MockERC20.sol";

/// @notice Test double for the Mezo Pools Router. Each token has a fixed 1e18-scaled exchange
///         rate into the route's output token, settable by the test; output is minted directly.
contract MockRouter is IRouter {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    mapping(address => uint256) public rate; // token -> value per 1e18 units, in output-token terms

    function setRate(address token, uint256 rateWad) external {
        rate[token] = rateWad;
    }

    function getAmountsOut(uint256 amountIn, Route[] memory routes) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        uint256 current = amountIn;
        for (uint256 i = 0; i < routes.length; i++) {
            current = (current * rate[routes[i].from]) / WAD;
            amounts[i + 1] = current;
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(routes.length > 0, "MockRouter: empty route");
        IERC20(routes[0].from).safeTransferFrom(msg.sender, address(this), amountIn);

        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        uint256 current = amountIn;
        for (uint256 i = 0; i < routes.length; i++) {
            current = (current * rate[routes[i].from]) / WAD;
            amounts[i + 1] = current;
        }
        require(current >= amountOutMin, "MockRouter: slippage");

        MockERC20(routes[routes.length - 1].to).mint(to, current);
    }
}
