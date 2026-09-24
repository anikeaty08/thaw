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

## Docs

- [System design](docs/THAW_SYSTEM_DESIGN.md) — architecture, contracts, loan math, risk engine, security, build plan, submission kit.

## Status

🚧 Design phase — Wave 1 build starts Oct 16, 2026 on Mezo testnet (chain ID 31611).
