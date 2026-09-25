import { onchainTable, index, relations } from "ponder";

// Mirrors ILoanManager.Loan (contracts/src/interfaces/ILoanManager.sol) plus derived fields the
// UI needs directly (borrower, running totals) so apps/web and apps/bot never have to multicall.
export const loan = onchainTable(
  "loan",
  (t) => ({
    id: t.bigint().primaryKey(), // loanId
    adapter: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    mode: t.text().notNull(), // "Advance" | "CreditLine"
    borrower: t.hex().notNull(),
    principal: t.bigint().notNull(), // last-known on-chain principal (pre-accrual snapshot)
    repayShareBps: t.integer().notNull(),
    aprBps: t.integer().notNull(),
    openedAt: t.bigint().notNull(),
    closed: t.boolean().notNull().default(false),
    liquidating: t.boolean().notNull().default(false),
    missedEpochs: t.integer().notNull().default(0),
    totalHarvested: t.bigint().notNull().default(0n),
    totalRepaid: t.bigint().notNull().default(0n),
    lastHarvestEpoch: t.bigint(),
  }),
  (table) => ({
    borrowerIdx: index().on(table.borrower),
    adapterIdx: index().on(table.adapter),
  }),
);

export const harvestEvent = onchainTable(
  "harvest_event",
  (t) => ({
    id: t.text().primaryKey(), // `${loanId}-${epoch}`
    loanId: t.bigint().notNull(),
    epoch: t.bigint().notNull(),
    musdIn: t.bigint().notNull(),
    toDebt: t.bigint().notNull(),
    fee: t.bigint().notNull(),
    surplus: t.bigint().notNull(),
    bounty: t.bigint().notNull(),
    keeper: t.hex(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    loanIdx: index().on(table.loanId),
  }),
);

export const voteEvent = onchainTable("vote_event", (t) => ({
  id: t.text().primaryKey(), // `${loanId}-${epoch}`
  loanId: t.bigint().notNull(),
  epoch: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const vaultFlow = onchainTable(
  "vault_flow",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    kind: t.text().notNull(), // "lend" | "repay" | "bad_debt" | "park_msr" | "pull_msr"
    amount: t.bigint().notNull(),
    counterparty: t.hex(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
);

export const auction = onchainTable("auction", (t) => ({
  id: t.bigint().primaryKey(), // loanId
  adapter: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  startPrice: t.bigint().notNull(),
  floorPrice: t.bigint().notNull(),
  startedAt: t.bigint().notNull(),
  settled: t.boolean().notNull().default(false),
  buyer: t.hex(),
  clearingPrice: t.bigint(),
  debtPortion: t.bigint(),
  penalty: t.bigint(),
  borrowerAmount: t.bigint(),
  badDebt: t.bigint(),
  settledAt: t.bigint(),
}));

export const strategyPost = onchainTable("strategy_post", (t) => ({
  id: t.text().primaryKey(), // `${adapter}-${epoch}`
  adapter: t.hex().notNull(),
  epoch: t.bigint().notNull(),
  strategyHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const loanRelations = relations(loan, ({ many }) => ({
  harvests: many(harvestEvent),
  votes: many(voteEvent),
}));

export const harvestEventRelations = relations(harvestEvent, ({ one }) => ({
  loan: one(loan, { fields: [harvestEvent.loanId], references: [loan.id] }),
}));

export const voteEventRelations = relations(voteEvent, ({ one }) => ({
  loan: one(loan, { fields: [voteEvent.loanId], references: [loan.id] }),
}));
