// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IReward } from "../../src/interfaces/IReward.sol";

/// @notice Test double for a Solidly-style Bribe/Fee reward contract. Rewards are pre-funded and
///         earned amounts set directly by the test rather than computed from real voting weights.
contract MockReward is IReward {
    using SafeERC20 for IERC20;

    address[] public tokenList;
    mapping(address => bool) internal _known;
    mapping(uint256 => mapping(address => uint256)) public earnedAmount;

    function setReward(uint256 tokenId, address token, uint256 amount) external {
        if (!_known[token]) {
            _known[token] = true;
            tokenList.push(token);
        }
        earnedAmount[tokenId][token] = amount;
    }

    function earned(address token, uint256 tokenId) external view returns (uint256) {
        return earnedAmount[tokenId][token];
    }

    function rewardsListLength() external view returns (uint256) {
        return tokenList.length;
    }

    function rewards(uint256 index) external view returns (address) {
        return tokenList[index];
    }

    /// @notice Called by MockVoter.claimBribes/claimFees on behalf of the escrow (the ve owner).
    function payout(uint256 tokenId, address[] memory tokens, address to) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amt = earnedAmount[tokenId][tokens[i]];
            if (amt == 0) continue;
            earnedAmount[tokenId][tokens[i]] = 0;
            IERC20(tokens[i]).safeTransfer(to, amt);
        }
    }

    function getReward(uint256, address[] memory) external pure {
        revert("MockReward: use payout via MockVoter");
    }
}
