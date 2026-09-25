// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IMUSDSavingsRate } from "../../src/interfaces/IMUSDSavingsRate.sol";

/// @notice Trivial 1:1 test double for the MUSD Savings Rate vault (no yield accrual).
contract MockMSR is IMUSDSavingsRate {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    mapping(address => uint256) public balanceOf;

    constructor(address _musd) {
        musd = IERC20(_musd);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        musd.safeTransferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += assets;
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        balanceOf[owner] -= assets;
        musd.safeTransfer(receiver, assets);
        return assets;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return balanceOf[owner];
    }
}
