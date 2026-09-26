const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069";

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${INDEXER_URL}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`Indexer query failed: ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`Indexer query errors: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("Indexer returned no data");
  return json.data;
}

export interface HarvestRow {
  id: string;
  epoch: string;
  musdIn: string;
  toDebt: string;
  fee: string;
  surplus: string;
  bounty: string;
  timestamp: string;
  txHash: string;
}

export async function fetchHarvestHistory(loanId: string): Promise<HarvestRow[]> {
  const data = await query<{ harvestEvents: { items: HarvestRow[] } }>(
    `query HarvestHistory($loanId: BigInt!) {
      harvestEvents(where: { loanId: $loanId }, orderBy: "epoch", orderDirection: "desc", limit: 52) {
        items { id epoch musdIn toDebt fee surplus bounty timestamp txHash }
      }
    }`,
    { loanId },
  );
  return data.harvestEvents.items;
}

export interface LoanRow {
  id: string;
  adapter: string;
  tokenId: string;
  mode: string;
  borrower: string;
  principal: string;
  closed: boolean;
  liquidating: boolean;
  totalHarvested: string;
  totalRepaid: string;
  openedAt: string;
}

export async function fetchLoansForBorrower(address: string): Promise<LoanRow[]> {
  const data = await query<{ loans: { items: LoanRow[] } }>(
    `query ByBorrower($borrower: String!) {
      loans(where: { borrower: $borrower }, limit: 50, orderBy: "openedAt", orderDirection: "desc") {
        items { id adapter tokenId mode borrower principal closed liquidating totalHarvested totalRepaid openedAt }
      }
    }`,
    { borrower: address.toLowerCase() },
  );
  return data.loans.items;
}

export interface AuctionRow {
  id: string;
  adapter: string;
  tokenId: string;
  startPrice: string;
  floorPrice: string;
  startedAt: string;
  settled: boolean;
  buyer: string | null;
  clearingPrice: string | null;
}

export async function fetchAuctions(): Promise<AuctionRow[]> {
  const data = await query<{ auctions: { items: AuctionRow[] } }>(`
    query AllAuctions {
      auctions(limit: 100, orderBy: "startedAt", orderDirection: "desc") {
        items { id adapter tokenId startPrice floorPrice startedAt settled buyer clearingPrice }
      }
    }
  `);
  return data.auctions.items;
}

export interface VaultFlowRow {
  id: string;
  kind: string;
  amount: string;
  timestamp: string;
}

export async function fetchVaultFlows(limit = 100): Promise<VaultFlowRow[]> {
  const data = await query<{ vaultFlows: { items: VaultFlowRow[] } }>(
    `query Flows($limit: Int!) {
      vaultFlows(limit: $limit, orderBy: "timestamp", orderDirection: "desc") {
        items { id kind amount timestamp }
      }
    }`,
    { limit },
  );
  return data.vaultFlows.items;
}

export interface LenderRow {
  deposited: string;
  withdrawn: string;
}

/** A lender's cost basis; null if they've never deposited. */
export async function fetchLender(address: string): Promise<LenderRow | null> {
  const data = await query<{ lender: LenderRow | null }>(
    `query Lender($id: String!) { lender(id: $id) { deposited withdrawn } }`,
    { id: address.toLowerCase() },
  );
  return data.lender;
}
