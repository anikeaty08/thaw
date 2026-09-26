// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice LoanManager-facing surface of the tMUSD vault. See TMUSDVault.sol and docs §12.
interface ILenderVault {
    function lendToLoanManager(uint256 amount) external;

    function receiveRepayment(uint256 amount) external;

    function realizeBadDebt(uint256 amount) external;

    function asset() external view returns (address);
}
