// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The core abstraction that isolates the Thaw core from any single Mezo ve-system ABI.
///         One adapter per collateral type (veMEZO, veBTC, ...). See docs/THAW_SYSTEM_DESIGN.md §8.3.
interface IVeAdapter {
    /// @notice The ERC-721 escrow token this adapter understands (veMEZO / veBTC NFT contract).
    function escrowToken() external view returns (address);

    /// @notice Casts (or re-casts) the vote for `tokenId` according to `strategy`
    ///         (abi-encoded gauges/weights, see StrategyRegistry).
    function vote(uint256 tokenId, bytes calldata strategy) external;

    /// @notice Claims all pending bribe/fee rewards for `tokenId` into the caller (the Harvester).
    function claim(uint256 tokenId) external returns (address[] memory tokens, uint256[] memory amounts);

    /// @notice View-only projection of claimable rewards, used for underwriting and UI quotes.
    function pendingRewards(uint256 tokenId) external view returns (address[] memory tokens, uint256[] memory amounts);

    /// @notice USD value of the locked collateral backing `tokenId`, 1e18-scaled, time-discounted.
    function collateralValueUSD(uint256 tokenId) external view returns (uint256);

    /// @notice Unix timestamp the lock unlocks at; `type(uint256).max` if permanently locked.
    function unlockTime(uint256 tokenId) external view returns (uint256);

    /// @notice Whether the NFT is currently free of any voting-state restriction on transfer/withdraw.
    function canRelease(uint256 tokenId) external view returns (bool);

    /// @notice Performs whatever the underlying ve system requires before the NFT can be released
    ///         (e.g. `Voter.reset`). May be a no-op depending on voting-state.
    function prepareRelease(uint256 tokenId) external;
}
