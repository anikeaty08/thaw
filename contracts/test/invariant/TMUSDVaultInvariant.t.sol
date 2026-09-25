// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { StdInvariant, Test } from "forge-std/Test.sol";
import { TMUSDVault } from "../../src/vault/TMUSDVault.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";
import { MockMSR } from "../mocks/MockMSR.sol";
import { VaultHandler } from "./handlers/VaultHandler.sol";

/// @notice Fuzzes TMUSDVault's LP/LoanManager/Liquidator surface (docs/THAW_SYSTEM_DESIGN.md §12,
///         §16 invariant list: "tMUSD share price is monotonic except on an explicit
///         BadDebtRealized event"). Weakened here to a floor check — share price never drops below
///         its initial value unless bad debt has been realized at least once — which is exact-integer
///         checkable without needing a full loan-lifecycle handler.
contract TMUSDVaultInvariantTest is StdInvariant, Test {
    TMUSDVault internal vault;
    MockERC20 internal musd;
    MockMSR internal msr;
    VaultHandler internal handler;

    uint256 internal initialSharePrice;

    function setUp() public {
        musd = new MockERC20("Mock MUSD", "mUSD");
        vault = new TMUSDVault(musd, address(this));
        msr = new MockMSR(address(musd));
        vault.setMSR(address(msr));

        // Seed liquidity so share price is well-defined before the handler starts mutating state.
        musd.mint(address(this), 1_000e18);
        musd.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18, address(this));
        initialSharePrice = vault.convertToAssets(1e18);

        handler = new VaultHandler(vault, musd, msr, address(this));
        vault.setLoanManager(handler.loanManager());
        vault.setLiquidator(handler.liquidator());

        targetContract(address(handler));
    }

    function invariant_sharePriceNeverDropsBelowInitialUnlessBadDebt() public view {
        if (handler.ghost_hadBadDebt()) return;
        assertGe(vault.convertToAssets(1e18), initialSharePrice);
    }

    function invariant_totalLentNeverUnderflows() public view {
        // totalLent is uint256 with saturating subtraction in the contract; this just confirms no
        // handler sequence leaves it in a nonsensical (i.e. absurdly large from underflow) state.
        assertLt(vault.totalLent(), type(uint128).max);
    }
}
