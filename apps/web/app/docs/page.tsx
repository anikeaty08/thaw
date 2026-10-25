import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DocsToc, type TocItem } from "@/components/docs/DocsToc";
import { DocsHero } from "@/components/docs/DocsHero";
import { LiveProtocol } from "@/components/docs/LiveProtocol";
import { Reveal } from "@/components/motion/Reveal";
import { MeltSimulator } from "@/components/landing/MeltSimulator";

export const metadata: Metadata = {
  title: "Docs — Thaw",
  description:
    "How Thaw works: Advance and Credit Line loans against veMEZO and veBTC, the Thursday harvest, the tMUSD vault, liquidations, risks and the live contracts.",
};

const SECTIONS: TocItem[] = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How a loan works" },
  { id: "modes", label: "Advance vs Credit Line" },
  { id: "harvest", label: "The Thursday harvest" },
  { id: "lending", label: "Lending MUSD" },
  { id: "liquidation", label: "Defaults and auctions" },
  { id: "risks", label: "Risks" },
  { id: "live", label: "Live protocol" },
];

export default function DocsPage() {
  return (
    <div className="overflow-x-clip">
      <SiteHeader />
      <main>
        <DocsHero />

        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:px-8">
          <DocsToc items={SECTIONS} />

          <article className="docs-prose min-w-0 max-w-3xl">
            <DocSection id="overview" title="Overview">
              <p>
                Thaw lends MUSD against locked Mezo positions: veMEZO and veBTC NFTs. A locked position can&apos;t be sold or
                withdrawn, but it earns rewards every week. Thaw lets you borrow against those rewards today, and uses them to
                pay the loan back automatically.
              </p>
              <ul>
                <li>You keep ownership on record. The NFT sits in Thaw&apos;s escrow and keeps voting and earning.</li>
                <li>Every Thursday a keeper claims your lock&apos;s rewards, swaps them to MUSD and pays down the debt.</li>
                <li>Lenders fund loans through the tMUSD vault and earn interest plus a share of harvests.</li>
              </ul>
            </DocSection>

            <DocSection id="how-it-works" title="How a loan works">
              <ol>
                <li>
                  <strong>Deposit a lock.</strong> Approve the escrow and deposit your veMEZO or veBTC NFT. Thaw reads its
                  trailing weekly income and its value.
                </li>
                <li>
                  <strong>Pick a mode and borrow.</strong> MUSD lands in your wallet in the same transaction.
                </li>
                <li>
                  <strong>Thursdays pay it down.</strong> Each epoch the keeper harvests and repays. You can also repay early
                  at any time from the loan page.
                </li>
                <li>
                  <strong>Take your lock back.</strong> When the debt reaches zero, withdraw the veNFT. It is still locked and
                  still earning. It was never sold.
                </li>
              </ol>
            </DocSection>

            <DocSection id="modes" title="Advance vs Credit Line">
              <p>Each loan picks one mode. The difference is what the loan is sized against, and what happens when things move.</p>
              <div className="not-prose mt-6 overflow-hidden rounded-2xl border border-glacier-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-glacier-900 text-mist-400">
                    <tr>
                      <th className="px-4 py-3 font-medium" scope="col"><span className="sr-only">Property</span></th>
                      <th className="px-4 py-3 font-medium text-frost-300" scope="col">Advance</th>
                      <th className="px-4 py-3 font-medium text-ember-400" scope="col">Credit Line</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glacier-700">
                    {MODE_ROWS.map((r) => (
                      <tr key={r[0]}>
                        <th scope="row" className="px-4 py-3 font-normal text-mist-400">{r[0]}</th>
                        <td className="px-4 py-3 text-frostwhite">{r[1]}</td>
                        <td className="px-4 py-3 text-frostwhite">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                An Advance is <code>weekly income × income counted × advance weeks</code>. With the demo terms (75% counted,
                10 weeks), a lock earning 60 MUSD a week can take 450 MUSD up front. Try it: change what the lock earns and
                play the Thursdays.
              </p>
              <div className="not-prose mt-6">
                <MeltSimulator />
                <p className="mt-3 px-1 text-xs leading-relaxed text-mist-500">
                  Illustration using the demo collateral terms: 6% APR, 75% of rewards counted, all of it applied to the debt.
                </p>
              </div>
            </DocSection>

            <DocSection id="harvest" title="The Thursday harvest">
              <p>
                Mezo epochs flip on Thursday at 00:00 UTC. Five minutes later, a keeper calls the harvester for each open loan.
                For every loan it:
              </p>
              <ol>
                <li>claims the lock&apos;s bribes and fees,</li>
                <li>swaps them to MUSD along allowlisted routes with a minimum-out guard,</li>
                <li>pays a small bounty to whoever called it and takes the protocol fee,</li>
                <li>applies the rest to the debt, then re-votes the lock for the next epoch.</li>
              </ol>
              <p>
                Harvesting is permissionless. Anyone can call it and collect the bounty, so repayments don&apos;t depend on one
                operator staying online.
              </p>
            </DocSection>

            <DocSection id="lending" title="Lending MUSD">
              <p>
                Lenders deposit MUSD into <strong>tMUSD</strong>, an ERC-4626 vault. Yield comes from loan interest, a share of
                harvested rewards, and idle MUSD parked in the MUSD Savings Rate.
              </p>
              <p>
                Withdrawals are instant up to the vault&apos;s idle liquidity. Anything beyond that queues and fills from the next
                harvests, which works because every loan pays down weekly.
              </p>
            </DocSection>

            <DocSection id="liquidation" title="Defaults and auctions">
              <p>
                A Credit Line becomes liquidatable when its health factor falls below 1.0. An Advance is only looked at after 8
                epochs with no repayment, and then only if its value-based health is also below 1.0.
              </p>
              <p>
                Liquidated locks are sold in a 24-hour Dutch auction that starts near market value and falls to a floor that
                covers the debt. Proceeds repay the vault first, a 2% penalty goes to the reserve, and anything left goes back
                to the borrower. If nobody bids, the reserve fund backstops the sale.
              </p>
            </DocSection>

            <DocSection id="risks" title="Risks">
              <ul>
                <li><strong>Testnet software.</strong> Thaw runs on Mezo testnet and has not been audited. Use test funds only.</li>
                <li><strong>Reward risk.</strong> If your lock earns less, an Advance takes longer to repay and a Credit Line&apos;s health falls.</li>
                <li><strong>Price risk.</strong> Credit Lines depend on oracle prices for MEZO and BTC and can be liquidated.</li>
                <li><strong>Smart contract risk.</strong> Bugs in Thaw or in the Mezo contracts it calls could lose funds.</li>
                <li><strong>Liquidity risk for lenders.</strong> Large withdrawals can wait for harvests when the vault is highly utilized.</li>
              </ul>
            </DocSection>

            <DocSection id="live" title="Live protocol">
              <p>Read straight from the contracts and the indexer. A dash means the value isn&apos;t available yet, never a guess.</p>
              <div className="not-prose">
                <LiveProtocol />
              </div>
            </DocSection>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const MODE_ROWS: [string, string, string][] = [
  ["Sized by", "Trailing weekly rewards", "Discounted lock value"],
  ["How much", "About 10 weeks of counted rewards", "25% (veMEZO) to 60% (veBTC) of value"],
  ["Interest", "Fixed APR, 5–6%", "Fixed APR, 5–6%"],
  ["If rewards drop", "The loan takes longer", "Health factor falls"],
  ["Price liquidation", "Never", "Below health factor 1.0"],
];

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-glacier-700 pt-12 first:border-t-0 first:pt-0 [&+&]:mt-12">
      <Reveal>
        <h2 id={`${id}-title`} className="display text-3xl leading-tight sm:text-4xl">
          {title}
        </h2>
        <div className="mt-5">{children}</div>
      </Reveal>
    </section>
  );
}
