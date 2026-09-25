// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Mezo Voter / boost-voter surface used to cast votes and claim bribe/fee rewards
///         on behalf of an escrowed veNFT. Verified against `IVoter` in mezo-org/tigris.
interface IVoter {
    function vote(uint256 tokenId, address[] calldata poolVote, uint256[] calldata weights) external;

    function reset(uint256 tokenId) external;

    function poke(uint256 tokenId) external;

    function claimBribes(address[] memory bribes, address[][] memory tokens, uint256 tokenId) external;

    function claimFees(address[] memory fees, address[][] memory tokens, uint256 tokenId) external;

    function gauges(address pool) external view returns (address);

    function gaugeToBribe(address gauge) external view returns (address);

    function gaugeToFees(address gauge) external view returns (address);

    function lastVoted(uint256 tokenId) external view returns (uint256);

    function isAlive(address gauge) external view returns (bool);

    function isWhitelistedNFT(uint256 tokenId) external view returns (bool);

    function maxVotingNum() external view returns (uint256);
}
