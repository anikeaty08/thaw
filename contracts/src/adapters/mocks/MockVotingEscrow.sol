// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVotingEscrow } from "../../interfaces/IVotingEscrow.sol";

/// @notice Minimal ERC-721 veNFT stand-in implementing enough of IVotingEscrow for MockVeAdapter,
///         unit tests, and demos when a real Mezo ve deployment isn't available (§8.3, §22 fallback).
/// @dev Does not formally `is IVotingEscrow`: ERC721 already implements the shared
///      ownerOf/transferFrom/approve signatures, and callers address this contract through
///      `IVotingEscrow(address(ve))`, so a diamond override isn't needed for those.
contract MockVotingEscrow is ERC721, Ownable {
    uint256 public nextId = 1;
    address public voter;

    mapping(uint256 => IVotingEscrow.LockedBalance) internal _locked;
    mapping(uint256 => bool) public voted;
    mapping(uint256 => bool) public deactivated;

    constructor(string memory name_, string memory symbol_, address initialOwner)
        ERC721(name_, symbol_)
        Ownable(initialOwner)
    { }

    function setVoterContract(address _voter) external onlyOwner {
        voter = _voter;
    }

    function mint(address to, uint256 amount, uint256 lockEnd, bool isPermanent)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        tokenId = nextId++;
        _locked[tokenId] =
            IVotingEscrow.LockedBalance({ amount: int128(uint128(amount)), end: lockEnd, isPermanent: isPermanent });
        _safeMint(to, tokenId);
    }

    function setVoted(uint256 tokenId, bool v) external {
        require(msg.sender == owner() || msg.sender == voter, "MockVotingEscrow: not authorized");
        voted[tokenId] = v;
    }

    function setDeactivated(uint256 tokenId, bool v) external onlyOwner {
        deactivated[tokenId] = v;
    }

    function locked(uint256 tokenId) external view returns (IVotingEscrow.LockedBalance memory) {
        return _locked[tokenId];
    }

    function balanceOfNFT(uint256 tokenId) external view returns (uint256) {
        IVotingEscrow.LockedBalance memory lb = _locked[tokenId];
        return lb.amount > 0 ? uint256(uint128(lb.amount)) : 0;
    }

    function lockPermanent(uint256 tokenId) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "not authorized");
        _locked[tokenId].isPermanent = true;
    }

    function increaseUnlockTime(uint256 tokenId, uint256 lockDuration) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "not authorized");
        _locked[tokenId].end = block.timestamp + lockDuration;
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool) {
        return _isAuthorized(_ownerOf(tokenId), spender, tokenId);
    }
}
