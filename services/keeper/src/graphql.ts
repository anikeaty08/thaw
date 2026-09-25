import { config } from "./config.js";

/// Thin client over the Ponder indexer's GraphQL API (indexer/ponder.schema.ts's `loan` table),
/// used so the keeper doesn't have to replay LoanOpened logs from genesis on every run.
async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${config.indexerUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) {
    throw new Error(`Indexer query failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`Indexer query errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

export async function fetchActiveLoanIds(): Promise<bigint[]> {
  const data = await query<{ loans: { items: { id: string }[] } }>(`
    query ActiveLoans {
      loans(where: { closed: false, liquidating: false }, limit: 1000) {
        items { id }
      }
    }
  `);
  return data.loans.items.map((l) => BigInt(l.id));
}

export async function fetchAllOpenLoanIds(): Promise<bigint[]> {
  const data = await query<{ loans: { items: { id: string }[] } }>(`
    query OpenLoans {
      loans(where: { closed: false }, limit: 1000) {
        items { id }
      }
    }
  `);
  return data.loans.items.map((l) => BigInt(l.id));
}
