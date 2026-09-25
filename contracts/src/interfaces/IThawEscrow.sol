// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Custodies veNFTs on behalf of open loans. Only the LoanManager, Harvester and Liquidator
///         may move NFTs in or out. See docs/THAW_SYSTEM_DESIGN.md §7.2.
interface IThawEscrow {
    function pull(address collection, address from, uint256 tokenId) external;

    function release(address collection, address to, uint256 tokenId) external;

    function isHeld(address collection, uint256 tokenId) external view returns (bool);

    function execute(address target, bytes calldata data) external returns (bytes memory);

    function sweepERC20(address token, uint256 amount, address to) external;
}
