// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { TMUSDVault } from "../../../src/vault/TMUSDVault.sol";
import { MockERC20 } from "../../mocks/MockERC20.sol";
import { MockMSR } from "../../mocks/MockMSR.sol";

/// @notice Randomized, bounded call sequence over TMUSDVault's LP + LoanManager + Liquidator
///         surface, used by TMUSDVaultInvariant.t.sol to fuzz the §12/§16 share-price invariant.
///         `loanManager`/`liquidator` are plain addresses (not real contracts) — the vault only
///         checks `msg.sender`, so pranking as them exercises the same access-controlled paths
///         without needing the full loan lifecycle.
contract VaultHandler is Test {
    TMUSDVault public vault;
    MockERC20 public musd;
    MockMSR public msr;

    address public loanManager = makeAddr("handlerLoanManager");
    address public liquidator = makeAddr("handlerLiquidator");
    address public owner;
    address[] public lps;

    bool public ghost_hadBadDebt;
    uint256 public ghost_outstandingLoan; // tracks what's "out" so receiveRepayment/realizeBadDebt stay bounded

    constructor(TMUSDVault _vault, MockERC20 _musd, MockMSR _msr, address _owner) {
        vault = _vault;
        musd = _musd;
        msr = _msr;
        owner = _owner;
        for (uint256 i = 0; i < 3; i++) {
            lps.push(makeAddr(string.concat("lp", vm.toString(i))));
        }
    }

    function _lp(uint256 seed) internal view returns (address) {
        return lps[seed % lps.length];
    }

    function deposit(uint256 seed, uint256 amount) external {
        address lp = _lp(seed);
        amount = bound(amount, 0, 1_000_000e18);
        if (amount == 0) return;
        musd.mint(lp, amount);
        vm.startPrank(lp);
        musd.approve(address(vault), amount);
        vault.deposit(amount, lp);
        vm.stopPrank();
    }

    function redeem(uint256 seed, uint256 sharesSeed) external {
        address lp = _lp(seed);
        uint256 maxShares = vault.maxRedeem(lp);
        if (maxShares == 0) return;
        uint256 shares = bound(sharesSeed, 0, maxShares);
        if (shares == 0) return;
        vm.prank(lp);
        vault.redeem(shares, lp, lp);
    }

    function lend(uint256 amount) external {
        uint256 idle = vault.idleLiquidity();
        if (idle == 0) return;
        amount = bound(amount, 0, idle);
        if (amount == 0) return;
        vm.prank(loanManager);
        vault.lendToLoanManager(amount);
        ghost_outstandingLoan += amount;
    }

    function repay(uint256 amount) external {
        if (ghost_outstandingLoan == 0) return;
        amount = bound(amount, 0, ghost_outstandingLoan);
        if (amount == 0) return;
        musd.mint(loanManager, amount);
        vm.startPrank(loanManager);
        musd.approve(address(vault), amount);
        vault.receiveRepayment(amount);
        vm.stopPrank();
        ghost_outstandingLoan -= amount;
    }

    function realizeBadDebt(uint256 amount) external {
        if (ghost_outstandingLoan == 0) return;
        amount = bound(amount, 1, ghost_outstandingLoan);
        vm.prank(liquidator);
        vault.realizeBadDebt(amount);
        ghost_outstandingLoan -= amount;
        ghost_hadBadDebt = true;
    }

    function parkInMSR(uint256 amount) external {
        uint256 idle = vault.idleLiquidity();
        if (idle == 0) return;
        amount = bound(amount, 0, idle);
        if (amount == 0) return;
        vm.prank(owner);
        vault.parkInMSR(amount);
    }

    function pullFromMSR(uint256 amount) external {
        uint256 avail = msr.balanceOf(address(vault));
        if (avail == 0) return;
        amount = bound(amount, 0, avail);
        if (amount == 0) return;
        vm.prank(owner);
        vault.pullFromMSR(amount);
    }
}
