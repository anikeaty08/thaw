# Thaw contracts

Foundry workspace. Solidity 0.8.24, `evm_version = "london"` (Mezo testnet has no PUSH0, per
[docs/THAW_SYSTEM_DESIGN.md §6.1](../docs/THAW_SYSTEM_DESIGN.md#6-mezo-primitives-we-build-on-verified)),
compiled `via_ir = true` (a couple of the harvest/repay paths are too stack-heavy for the legacy
codegen). OpenZeppelin is pinned to **v5.0.2**, not latest — newer releases use `MCOPY`, a Cancun
opcode London doesn't have.

## Layout

```
src/
  interfaces/        IVotingEscrow, IVoter, IReward, IRouter (§6.3, verified against tigris) plus
                      Thaw's own ILoanManager/IVeAdapter/IThawEscrow/... internal interfaces
  core/               LoanManager, ThawEscrow, RiskEngine, Harvester, PositionNFT
  vault/              TMUSDVault (ERC-4626)
  adapters/           BaseVeAdapter, SolidlyVeAdapter (shared claim/vote plumbing),
                      VeBTCAdapter, VeMEZOAdapter, MockVeAdapter + mocks/ (demo-fallback ve system)
  oracle/             OracleRouter (primary feed + Mezo-Pools fallback quote + deviation guard)
  strategy/           StrategyRegistry (optimizer-posted vote strategy per adapter/epoch)
  liquidation/        DutchAuctionLiquidator, ReserveFund
test/
  TestBase.sol        Full system wired with MockVeAdapter, for fast LoanManager/Harvester/Vault tests
  unit/               One file per contract/flow, including a VeBTCAdapter integration test against
                      MockVoter/MockReward/MockRouter (the real Solidly claim/vote path)
  mocks/              Test-only doubles (MockERC20, MockRouter, MockVoter, MockReward, MockMSR, MockPriceFeed)
script/
  Deploy.s.sol        Deploys the full stack; reads MUSD_ADDRESS/VEBTC_ADDRESS/VEBTC_VOTER/etc. from
                      env so the same script targets Anvil (all mocked) or Mezo testnet (real MUSD +
                      veBTC + Voter + Router). Always deploys MockVeAdapter too, as the demo fallback (§23).
```

## What's implemented

- **Advance mode** (§9.2): income-based underwriting, EMA trailing income with bootstrap haircut,
  payoff-guarantee check, 8-missed-epoch backstop into value-based health.
- **Credit Line mode** (§9.3): LTV/liqLTV per adapter, veMEZO time-discount `D(t)`, veBTC's flat 0.95
  discount, both against an `OracleRouter` price.
- **Harvester pipeline** (§8.4): claim → swap (allowlisted tokens/routes only) → bounty → protocol fee
  → debt/surplus split → re-vote, batched via `harvestMany` with per-loan try/catch isolation.
- **tMUSD vault** (§12): ERC-4626, MSR park/pull for idle liquidity, instant-liquidity-capped
  withdrawals, a FIFO async redeem queue for anything beyond idle, bad-debt write-down.
- **Dutch-auction liquidation** (§11.2): 24h linear decay, ReserveFund floor backstop, bad-debt
  socialization to the vault, all gated through `LoanManager.markLiquidating`/`closeLiquidatedLoan`.
- **Adapter isolation** (§7.3, §8.3): the core never imports a Mezo ABI directly. `SolidlyVeAdapter`
  implements the real claim/vote flow generically (shared by `VeBTCAdapter` and `VeMEZOAdapter`);
  `MockVeAdapter` is a fully self-contained stand-in for tests and a testnet demo fallback.
- **Threat-model mitigations** (§16): reentrancy guards + CEI ordering, reward-token allowlisting,
  oracle-quoted slippage caps, per-adapter debt ceilings, a pause guardian, 2-tier escrow privilege
  (`CONTROLLER` for LoanManager/Liquidator, per-adapter `EXECUTOR` for vote/claim only, restricted to
  an allowlisted target so a bad adapter can't call arbitrary contracts through the escrow).

## What's still open (see docs §22-23)

- **veMEZO / boost-voter address** isn't confirmed on testnet. `VeMEZOAdapter` is written and tested
  against the same `SolidlyVeAdapter` path as `VeBTCAdapter`, so wiring the real address is a
  `Deploy.s.sol` env-var change, not a contract change.
- **PositionNFT transfer semantics for an active loan mid-transfer** aren't specially handled beyond
  standard ERC-721 transfer (the new holder becomes the borrower of record, per §7.2's "transferable
  loans" intent) — no Wave-2 marketplace integration yet.
- **StrategyRegistry weights** use a simple bps-sum-to-10000 check; the real water-filling allocation
  that produces those weights lives in `services/optimizer` (off-chain), not on-chain.

## Testing

```bash
forge test                          # 31 tests across 7 suites (30 unit/integration + 1 invariant)
forge coverage --ir-minimum --report summary
forge fmt --check
```

`test/invariant/` fuzzes `TMUSDVault` through a bounded LP/LoanManager/Liquidator handler
(`VaultHandler.sol`) and checks the §12/§16 share-price invariant: it never drops below its
starting value unless `BadDebtRealized` has fired at least once. That's the one invariant handler
built so far; the rest of the §16 invariant list (escrowed-NFT-to-loan bijection, harvest-never-
over-repays, debt-ceiling-never-breached) are good next additions using the same pattern. The CI
profile (`foundry.toml [profile.ci]`) is already configured for `fuzz.runs = 10000` /
`invariant.runs = 256` for when those land.
