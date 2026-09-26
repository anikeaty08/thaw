// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Common surface of Mezo's Solidly/Velodrome-v2-style VotingEscrow (veBTC / veMEZO).
/// @dev Verified against github.com/mezo-org/tigris `IVotingEscrow`. Kept minimal and adapter-facing;
///      the core protocol never imports this directly (see IVeAdapter).
interface IVotingEscrow {
    struct LockedBalance {
        int128 amount;
        uint256 end;
        bool isPermanent;
    }

    function ownerOf(uint256 tokenId) external view returns (address);

    function safeTransferFrom(address from, address to, uint256 tokenId) external;

    function transferFrom(address from, address to, uint256 tokenId) external;

    function approve(address to, uint256 tokenId) external;

    function locked(uint256 tokenId) external view returns (LockedBalance memory);

    function balanceOfNFT(uint256 tokenId) external view returns (uint256);

    function voted(uint256 tokenId) external view returns (bool);

    function lockPermanent(uint256 tokenId) external;

    function increaseUnlockTime(uint256 tokenId, uint256 lockDuration) external;

    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);

    function deactivated(uint256 tokenId) external view returns (bool);
}
