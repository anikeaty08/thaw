"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { addresses, erc721Abi } from "@/lib/contracts";
import { isConfigured, useFaucet, useMaxBorrow, useOwnedLocks, type OwnedLock } from "@/lib/hooks";
import { fetchLoansForBorrower, type LoanRow } from "@/lib/graphql";
import { useAsync } from "@/lib/useAsync";
import { formatMusd } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { IndexerError, SkeletonRows } from "@/components/ui/IndexerError";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";
import { BorrowDrawer } from "@/components/borrow/BorrowDrawer";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [drawerTokenId, setDrawerTokenId] = useState<bigint | null>(null);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupTokenId, setLookupTokenId] = useState<bigint | null>(null);

  const owned = useOwnedLocks(address);
  const loans = useAsync<LoanRow[]>(address && isConfigured ? () => fetchLoansForBorrower(address) : null, [], [address]);
  const openLoans = loans.data.filter((l) => !l.closed);
  const outstanding = openLoans.reduce((sum, l) => sum + BigInt(l.principal), 0n);
  const repaid = loans.data.reduce((sum, l) => sum + BigInt(l.totalRepaid ?? "0"), 0n);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (lookupInput) setLookupTokenId(BigInt(lookupInput));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Portfolio" description="Your open loans, and any veMEZO or veBTC lock you want to borrow against." />

      {!isConfigured && <NotConfiguredBanner />}

      {!isConnected ? (
        <div className="mt-8">
          <EmptyState icon="wallet" title="Connect a wallet to see your locks" action={<ConnectButton label="Connect wallet" />}>
            Thaw reads your veMEZO and veBTC positions straight from the chain. Connecting doesn't ask you to sign anything.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatTile label="Owed across loans" value={formatMusd(outstanding)} unit="MUSD" tone="frost" />
            <StatTile label="Paid by rewards so far" value={formatMusd(repaid)} unit="MUSD" tone="ember" />
            <StatTile label="Open loans" value={loans.status === "loading" ? "…" : openLoans.length} tone="neutral" className="col-span-2 lg:col-span-1" />
          </div>

          <section className="mt-10" aria-labelledby="open-loans">
            <h2 id="open-loans" className="section-title">
              Open loans
            </h2>
            <div className="mt-4">
              {loans.status === "loading" ? (
                <SkeletonRows />
              ) : loans.status === "error" ? (
                <IndexerError what="your loans" onRetry={loans.retry} />
              ) : openLoans.length === 0 ? (
                <EmptyState icon="snowflake" title="No open loans" compact>
                  Pick one of your locks below to see how much you can borrow against it.
                </EmptyState>
              ) : (
                <ul className="grid gap-3">
                  {openLoans.map((loan) => (
                    <li key={loan.id}>
                      <LoanCard loan={loan} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="new-loan">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="new-loan" className="section-title">
                  Your locks
                </h2>
                <p className="mt-1.5 text-sm text-mist-400">veNFTs in this wallet that you can borrow against.</p>
              </div>
            </div>

            <FaucetCard address={address} onDripped={owned.refetch} />

            <div className="mt-4">
              {owned.isLoading ? (
                <SkeletonRows rows={2} height={148} />
              ) : owned.isError ? (
                <p className="flex items-center gap-2 text-sm text-mist-400">
                  <Icon name="warning" size={16} className="text-ember-400" />
                  Couldn't read your locks from the chain. Refresh to try again.
                </p>
              ) : owned.locks.length === 0 ? (
                <EmptyState icon="lock" title="No locks in this wallet" compact>
                  Locks already backing a loan are held in escrow and show up under Open loans.
                </EmptyState>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {owned.locks.map((lock) => (
                    <li key={lock.tokenId.toString()}>
                      <LockCard lock={lock} onBorrow={() => setDrawerTokenId(lock.tokenId)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="group mt-6">
              <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 text-sm text-mist-400 hover:text-frostwhite">
                <Icon name="arrow-right" size={14} className="transition-transform group-open:rotate-90" />
                Don't see a lock? Look it up by token ID
              </summary>
              <form onSubmit={handleLookup} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="field sm:w-64">
                  <Icon name="search" size={16} className="text-mist-500" />
                  <span className="sr-only">Lock token ID</span>
                  <input
                    inputMode="numeric"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Token ID, like 42"
                  />
                </label>
                <Button type="submit" variant="secondary" disabled={!lookupInput}>
                  Check this lock
                </Button>
              </form>
              {lookupTokenId !== null && (
                <PositionLookup tokenId={lookupTokenId} owner={address} onBorrow={() => setDrawerTokenId(lookupTokenId)} />
              )}
            </details>
          </section>
        </>
      )}

      {drawerTokenId !== null && (
        <BorrowDrawer
          tokenId={drawerTokenId}
          onClose={() => {
            setDrawerTokenId(null);
            owned.refetch();
            loans.retry();
          }}
        />
      )}
    </div>
  );
}

function LoanCard({ loan }: { loan: LoanRow }) {
  const owed = BigInt(loan.principal);
  const repaid = BigInt(loan.totalRepaid ?? "0");
  const total = owed + repaid;
  const meltedPct = total > 0n ? Number((repaid * 1000n) / total) / 10 : 0;

  return (
    <Link
      href={`/loans/${loan.id}`}
      className="frost-panel group block px-5 py-4 transition-colors hover:border-frost-400/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold text-frostwhite">
              Loan #{loan.id}
            </span>
            <Badge tone={loan.mode === "Advance" ? "frost" : "ember"}>{loan.mode === "Advance" ? "Advance" : "Credit Line"}</Badge>
            {loan.liquidating && (
              <Badge tone="danger" pulse>
                In auction
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-mist-400">Lock #{loan.tokenId}</p>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="tabular font-display text-lg font-semibold text-frostwhite">
              {formatMusd(owed)} <span className="text-xs font-normal text-mist-500">MUSD</span>
            </div>
            <div className="text-xs text-mist-400">still owed</div>
          </div>
          <Icon name="arrow-right" size={18} className="text-mist-500 transition-transform group-hover:translate-x-0.5 group-hover:text-frost-300" />
        </div>
      </div>
      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-glacier-700" role="presentation">
          <div className="h-full rounded-full bg-thaw-gradient" style={{ width: `${Math.max(meltedPct, 1)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-mist-500">
          <span className="tabular text-mist-300">{meltedPct.toFixed(0)}%</span> paid off by rewards
        </p>
      </div>
    </Link>
  );
}

function PositionLookup({ tokenId, owner, onBorrow }: { tokenId: bigint; owner: `0x${string}` | undefined; onBorrow: () => void }) {
  const nftOwner = useReadContract({
    address: addresses.mockVe,
    abi: erc721Abi,
    functionName: "ownerOf",
    args: [tokenId],
    query: { enabled: isConfigured },
  });

  const maxAdvance = useMaxBorrow(addresses.mockAdapter, tokenId, 0);
  const maxCreditLine = useMaxBorrow(addresses.mockAdapter, tokenId, 1);

  if (nftOwner.isError) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-glacier-700 px-4 py-3 text-sm text-mist-400">
        <Icon name="warning" size={16} className="text-ember-400" />
        There's no lock with token ID {tokenId.toString()}. Check the number and try again.
      </div>
    );
  }

  const loading = nftOwner.isLoading;
  const isOwner = nftOwner.data && owner && (nftOwner.data as string).toLowerCase() === owner.toLowerCase();

  return (
    <div className={clsx("frost-panel mt-4 px-5 py-5", loading && "animate-pulse")}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="lock" size={18} className="text-frost-300" />
        <span className="font-medium text-frostwhite">Lock #{tokenId.toString()}</span>
        {!loading && (isOwner ? <Badge tone="frost">Yours, ready to borrow</Badge> : <Badge tone="neutral">Owned by another wallet</Badge>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-glacier-900/60 px-4 py-3">
          <div className="text-xs text-mist-400">Advance up to</div>
          <div className="tabular mt-1 font-display text-lg font-semibold text-frost-200">
            {formatMusd((maxAdvance.data as bigint) ?? undefined)} <span className="text-xs font-normal text-mist-500">MUSD</span>
          </div>
        </div>
        <div className="rounded-xl bg-glacier-900/60 px-4 py-3">
          <div className="text-xs text-mist-400">Credit Line up to</div>
          <div className="tabular mt-1 font-display text-lg font-semibold text-ember-400">
            {formatMusd((maxCreditLine.data as bigint) ?? undefined)} <span className="text-xs font-normal text-mist-500">MUSD</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-mist-500">
          {isOwner ? "You'll choose the loan type and amount next." : "Only the wallet that owns this lock can borrow against it."}
        </p>
        <Button disabled={!isOwner} onClick={onBorrow} className="w-full sm:w-auto">
          Set up a loan
        </Button>
      </div>
    </div>
  );
}

function LockCard({ lock, onBorrow }: { lock: OwnedLock; onBorrow: () => void }) {
  return (
    <div className="frost-panel flex h-full flex-col px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-glacier-700 bg-glacier-800 text-frost-300">
          <Icon name="lock" size={16} />
        </span>
        <span className="font-semibold text-frostwhite">Lock #{lock.tokenId.toString()}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-mist-400">Advance up to</dt>
          <dd className="tabular mt-0.5 font-semibold text-frost-200">
            {formatMusd(lock.maxAdvance)} <span className="text-xs font-normal text-mist-500">MUSD</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-mist-400">Credit Line up to</dt>
          <dd className="tabular mt-0.5 font-semibold text-ember-400">
            {formatMusd(lock.maxCreditLine)} <span className="text-xs font-normal text-mist-500">MUSD</span>
          </dd>
        </div>
      </dl>
      <Button onClick={onBorrow} className="mt-4 w-full" disabled={!lock.maxAdvance && !lock.maxCreditLine}>
        Borrow against this lock
      </Button>
    </div>
  );
}

function FaucetCard({ address, onDripped }: { address: `0x${string}` | undefined; onDripped: () => void }) {
  const faucet = useFaucet(address);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  // Refresh the lock list once the drip is mined.
  useEffect(() => {
    if (faucet.isDone) onDripped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faucet.isDone]);

  if (!faucet.available) return null;
  const coolingDown = faucet.readyAt > now;
  const hoursLeft = Math.ceil((faucet.readyAt - now) / 3600);

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-frost-400/30 bg-frost-400/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-frost-400/15 text-frost-300">
          <Icon name="snowflake" size={18} />
        </span>
        <div>
          <p className="text-sm font-medium text-frostwhite">Trying Thaw on testnet?</p>
          <p className="mt-0.5 text-sm text-mist-400">
            Get 1,000 test MUSD and a demo lock that earns 60 MUSD a week. You'll need a little testnet BTC for fees.
          </p>
        </div>
      </div>
      <Button onClick={faucet.drip} disabled={faucet.isBusy || coolingDown} className="w-full shrink-0 sm:w-auto">
        {faucet.isBusy ? "Sending…" : coolingDown ? `Available in ${hoursLeft}h` : "Get test tokens"}
      </Button>
    </div>
  );
}
