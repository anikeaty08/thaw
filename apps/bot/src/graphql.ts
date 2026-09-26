import type { Address } from "viem";
import { config } from "./config.js";

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${config.indexerUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`Indexer query failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`Indexer query errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

export interface LoanSummary {
  id: string;
  mode: string;
  principal: string;
  closed: boolean;
  liquidating: boolean;
  totalHarvested: string;
  totalRepaid: string;
}

export async function fetchLoansForBorrower(address: Address): Promise<LoanSummary[]> {
  const data = await query<{ loans: { items: LoanSummary[] } }>(
    `query LoansByBorrower($borrower: String!) {
      loans(where: { borrower: $borrower, closed: false }, limit: 50) {
        items { id mode principal closed liquidating totalHarvested totalRepaid }
      }
    }`,
    { borrower: address.toLowerCase() },
  );
  return data.loans.items;
}

export async function fetchAllOpenLoansWithBorrowers(): Promise<{ id: string; borrower: string }[]> {
  const data = await query<{ loans: { items: { id: string; borrower: string }[] } }>(`
    query AllOpen {
      loans(where: { closed: false }, limit: 1000) {
        items { id borrower }
      }
    }
  `);
  return data.loans.items;
}
