// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PositionNFT
/// @notice ERC-721 loan receipt. Holding the token makes you the borrower of record for that
///         loanId, which is what makes a Thaw loan transferable (Wave 2, §7.2).
contract PositionNFT is ERC721, Ownable {
    address public loanManager;

    error NotLoanManager();

    event LoanManagerSet(address indexed loanManager);

    constructor(address initialOwner) ERC721("Thaw Position", "THAW-POS") Ownable(initialOwner) { }

    modifier onlyLoanManager() {
        if (msg.sender != loanManager) revert NotLoanManager();
        _;
    }

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
        emit LoanManagerSet(_loanManager);
    }

    function mint(address to, uint256 loanId) external onlyLoanManager {
        _safeMint(to, loanId);
    }

    function burn(uint256 loanId) external onlyLoanManager {
        _update(address(0), loanId, address(0));
    }
}
