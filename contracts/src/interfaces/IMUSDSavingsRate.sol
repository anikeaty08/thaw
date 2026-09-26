// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal surface of Mezo's MUSD Savings Rate (MSR) vault, used by TMUSDVault to park idle
///         liquidity as a yield floor. See docs/THAW_SYSTEM_DESIGN.md §6.4 and §12.
interface IMUSDSavingsRate {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    function balanceOf(address account) external view returns (uint256);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function maxWithdraw(address owner) external view returns (uint256);
}
