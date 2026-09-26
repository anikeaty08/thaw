# Thaw

**Self-repaying MUSD credit for locked Mezo positions.**
Borrow MUSD against your locked veMEZO / veBTC — your weekly Mezo Earn rewards pay it back.

Built for the [Mezo Buildathon](https://app.akindo.io/wave-hacks) (Track 1: DeFi · Track 2: Access & Distribution).

## How it works

1. **Deposit** a veMEZO or veBTC NFT into Thaw's escrow.
2. **Borrow** MUSD instantly — sized by the position's reward income (*Advance*, never price-liquidated) or its discounted value (*Credit Line*).
3. **Every Thursday epoch**, a permissionless keeper votes the NFT, claims bribes/fees, swaps them to MUSD via Mezo Pools, and repays the loan.
4. **Lenders** deposit MUSD into the ERC-4626 **tMUSD** vault and earn yield backed by Mezo's own reward flows.

## Mezo integration

MUSD · MEZO · veMEZO · veBTC · Voter / gauges · Bribe & Fee rewards · Router / Pools · MUSD Savings Rate

## Repo layout

```
contracts/          Foundry: LoanManager, ThawEscrow, RiskEngine, Harvester, TMUSDVault (ERC-4626),
                     DutchAuctionLiquidator, ReserveFund, PositionNFT, OracleRouter, StrategyRegistry,
                     adapters (VeBTC, VeMEZO, Mock) — see contracts/README.md
indexer/             Ponder indexer over LoanManager/Harvester/TMUSDVault/DutchAuctionLiquidator events
services/keeper/     Weekly harvest batching + health-factor liquidation sweep (viem)
services/optimizer/  Vote-strategy water-filling allocator, posts to StrategyRegistry
apps/bot/            Telegram bot (Track 2): /connect, /loans, /quote, epoch reports, liquidation alerts
docs/                System design, this README
.github/workflows/   CI: forge build/test/coverage/Slither + typecheck for every JS service
```

## Running it locally

```bash
# Contracts: build + full test suite (Foundry, London EVM per §6.1)
cd contracts && forge build && forge test

# Deploy everything (mocked MUSD + MockVeAdapter if MUSD_ADDRESS/VEBTC_ADDRESS are unset)
forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast

# Off-chain services (each has its own .env.example)
cd indexer && npm install && npm run dev
cd services/keeper && npm install && npm start
cd services/optimizer && npm install && npm start
cd apps/bot && npm install && npm start
```

## Docs

- [System design](docs/THAW_SYSTEM_DESIGN.md) — architecture, contracts, loan math, risk engine, security, build plan, submission kit.
- [Contracts README](contracts/README.md) — how the Solidity maps to the design doc, what's implemented vs. Wave 2.

## Status

🛠️ Backend implemented against the Wave 1 + Wave 2 design: full Solidity core (Advance + Credit Line,
Dutch-auction liquidation, tMUSD vault, adapters), 31 passing Foundry tests (unit + integration +
invariant), and the keeper/optimizer/indexer/bot services. Not yet deployed to Mezo testnet (chain ID
31611) — real veMEZO/veBTC/Voter/Router addresses from §6.2/§22 still need to be wired into
`script/Deploy.s.sol`. Frontend (`apps/web`) not built.
