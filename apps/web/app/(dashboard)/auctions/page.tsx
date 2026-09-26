"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { IndexerError, SkeletonRows } from "@/components/ui/IndexerError";
import { useAsync } from "@/lib/useAsync";
import { addresses, abis, erc20Abi } from "@/lib/contracts";
import { isConfigured, useApproveThenWrite } from "@/lib/hooks";
import { fetchAuctions, type AuctionRow } from "@/lib/graphql";
import { formatMusd, shortAddress } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";
import { AuctionPriceChart } from "@/components/charts/AuctionPriceChart";

export default function AuctionsPage() {
  const auctions = useAsync<AuctionRow[]>(isConfigured ? fetchAuctions : null, [], []);

  const live = auctions.data.filter((a) => !a.settled);
  const settled = auctions.data.filter((a) => a.settled);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Auctions"
        description="When a Credit Line falls below a health factor of 1, its lock is sold here. The price starts near market value and drops for 24 hours to a floor. Anyone can buy."
      />

      {!isConfigured && <NotConfiguredBanner />}

      <section className="mt-8" aria-labelledby="live-auctions">
        <h2 id="live-auctions" className="section-title">
          Live now
        </h2>
        <div className="mt-4">
        {auctions.status === "loading" ? (
          <SkeletonRows rows={1} height={280} />
        ) : auctions.status === "error" ? (
          <IndexerError what="auctions" onRetry={auctions.retry} />
        ) : live.length === 0 ? (
          <EmptyState icon="gavel" title="No auctions running">
            Every loan is healthy right now. Advance loans never end up here; only Credit Lines can.
          </EmptyState>
        ) : (
          <div className="mt-3 grid gap-4">
            {live.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
        </div>
      </section>

      {settled.length > 0 && (
        <section className="mt-10" aria-labelledby="settled-auctions">
          <h2 id="settled-auctions" className="section-title">
            Settled
          </h2>
          <ul className="frost-panel mt-4 divide-y divide-glacier-700">
            {settled.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-5 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-mist-300">
                  Loan #{a.id}, lock #{a.tokenId}
                </span>
                <span className="text-frostwhite">
                  <span className="tabular font-medium">{a.clearingPrice ? formatMusd(BigInt(a.clearingPrice)) : "—"} MUSD</span>
                  <span className="text-mist-500"> to </span>
                  <span className="font-mono text-xs">{shortAddress(a.buyer ?? undefined)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AuctionCard({ auction }: { auction: AuctionRow }) {
  const [price, setPrice] = useState(0);
  const startPrice = Number(auction.startPrice) / 1e18;
  const floorPrice = Number(auction.floorPrice) / 1e18;
  const startedAt = Number(auction.startedAt);

  useEffect(() => {
    function tick() {
      const elapsedHrs = (Date.now() / 1000 - startedAt) / 3600;
      const p = Math.max(floorPrice, startPrice - ((startPrice - floorPrice) * Math.min(elapsedHrs, 24)) / 24);
      setPrice(p);
    }
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [startPrice, floorPrice, startedAt]);

  const buy = useApproveThenWrite();

  function handleBuy() {
    const priceWad = BigInt(Math.ceil(price * 1e18));
    buy.run(
      { address: addresses.musd, abi: erc20Abi, functionName: "approve", args: [addresses.liquidator, priceWad] },
      { address: addresses.liquidator, abi: abis.liquidator as any, functionName: "buy", args: [BigInt(auction.id)] },
      {
        approve: { pending: "Approving MUSD for the auction", success: "MUSD approved" },
        action: { pending: `Buying lock #${auction.tokenId}`, success: `Lock #${auction.tokenId} is yours` },
      },
    );
  }

  return (
    <div className="frost-panel px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="lock" size={16} className="text-frost-300" />
            <span className="font-semibold text-frostwhite">Lock #{auction.tokenId}</span>
            <Badge tone="ember" pulse>
              Live
            </Badge>
          </div>
          <p className="mt-1 text-xs text-mist-500">From loan #{auction.id}. Price updates every 15 seconds.</p>
        </div>
        <div className="text-right">
          <div className="tabular text-2xl font-bold tracking-tight text-ember-400">
            {price.toFixed(2)} <span className="text-sm font-normal text-mist-500">MUSD</span>
          </div>
          <div className="text-xs text-mist-400">Price right now</div>
        </div>
      </div>
      <div className="mt-4">
        <AuctionPriceChart startPrice={startPrice} floorPrice={floorPrice} startedAt={startedAt} currentPrice={price} />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-mist-500">Floor price: {floorPrice.toFixed(2)} MUSD</p>
        <Button onClick={handleBuy} disabled={buy.isApproving || buy.isActing} className="w-full sm:w-auto">
          {buy.isApproving ? "Approving MUSD…" : buy.isActing ? "Buying…" : `Buy for ${price.toFixed(2)} MUSD`}
        </Button>
      </div>
    </div>
  );
}
