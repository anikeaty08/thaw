// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVeAdapter } from "../interfaces/IVeAdapter.sol";
import { IThawEscrow } from "../interfaces/IThawEscrow.sol";

/// @title BaseVeAdapter
/// @notice Shared plumbing for IVeAdapter implementations: escrow passthrough (vote/claim execute
///         *as* the escrow, which is the actual NFT owner) and role gating so only the Harvester
///         can trigger claim/vote and only the LoanManager can trigger prepareRelease.
///         See docs/THAW_SYSTEM_DESIGN.md §8.3, §16 threat #7.
abstract contract BaseVeAdapter is IVeAdapter, Ownable {
    address public immutable escrowTokenAddr;
    IThawEscrow public immutable thawEscrow;

    address public harvester;
    address public loanManager;

    error NotHarvester();
    error NotLoanManager();

    constructor(address initialOwner, address _escrowToken, address _thawEscrow) Ownable(initialOwner) {
        escrowTokenAddr = _escrowToken;
        thawEscrow = IThawEscrow(_thawEscrow);
    }

    modifier onlyHarvester() {
        if (msg.sender != harvester) revert NotHarvester();
        _;
    }

    modifier onlyLoanManager() {
        if (msg.sender != loanManager) revert NotLoanManager();
        _;
    }

    function setHarvester(address _harvester) external onlyOwner {
        harvester = _harvester;
    }

    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = _loanManager;
    }

    function escrowToken() external view returns (address) {
        return escrowTokenAddr;
    }

    function _execute(address target, bytes memory data) internal returns (bytes memory) {
        return thawEscrow.execute(target, data);
    }

    function _sweep(address token, uint256 amount, address to) internal {
        thawEscrow.sweepERC20(token, amount, to);
    }
}
