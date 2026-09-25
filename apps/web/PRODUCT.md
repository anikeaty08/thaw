# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences with equal weight (confirmed):

- **Borrowers:** holders of locked veMEZO or veBTC who want MUSD liquidity without unlocking. Their job: find out how much a lock can borrow, open a loan, and watch it get repaid.
- **Lenders:** MUSD holders who deposit into the tMUSD ERC-4626 vault. Their job: judge the vault's safety (utilization, bad debt, parameters) and deposit or withdraw.

Both must be able to reach their path from the landing page in one step.

## Product Purpose

Thaw lends MUSD against locked Mezo positions. Each Thursday epoch, a permissionless keeper votes the escrowed veNFT, claims bribes and fees, swaps them to MUSD and repays the loan. Success means a borrower understands "my lock's own rewards pay this off" within seconds.

## Positioning

Self-repaying credit on Mezo: the repayment source is the collateral's own weekly reward stream, and the Advance mode is sized by income, so it is never price-liquidated.

## Operating Context

- Mezo testnet, chain 31611. Contracts are not deployed yet (inferred from README): every screen must hold up with no on-chain data and no indexer.
- Data comes from wagmi contract reads plus a Ponder GraphQL indexer (`NEXT_PUBLIC_INDEXER_URL`).
- Wallet connection via RainbowKit.

## Capabilities and Constraints

- Loan modes: **Advance** (sized by trailing income, extends instead of liquidating) and **Credit Line** (sized by discounted value, 25–60% LTV, Dutch-auction liquidation below health factor 1.0).
- Harvests run Thursdays, 00:05 UTC. APR shown as 6% fixed (from the current contracts and UI; confirm before mainnet).
- Routes: `/` landing, `/portfolio`, `/loans/[id]`, `/lend`, `/auctions`, `/transparency`.

## Brand Commitments

- Name **Thaw** and the six-armed crystal mark (frost to ember gradient). Confirmed binding.
- Dark "thaw" identity: collateral is frozen (cold cyan), repayment is warm (ember). Confirmed binding.

## Evidence on Hand

- No testimonials, users, TVL history or audits exist. Do not fabricate any. Live figures come only from the vault contract.
- System design: `docs/THAW_SYSTEM_DESIGN.md`.

## Product Principles

1. Show the mechanism, don't describe it: repayment by rewards should be visible, not claimed.
2. Honest with empty data: a missing number reads "—" with a reason, never a fake value.
3. Borrower and lender paths are peers.
4. Risk is stated plainly: liquidation terms appear next to the loan size, never in fine print.
