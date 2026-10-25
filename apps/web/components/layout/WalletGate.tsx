"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Wordmark } from "@/components/ui/ThawMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { ScrambleText } from "@/components/motion/ScrambleText";

const CrystalScene = dynamic(() => import("@/components/three/CrystalScene"), { ssr: false });

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: "eye", text: "Connecting only shares your address. Nothing is signed." },
  { icon: "lock", text: "Your lock stays yours on record the whole time." },
  { icon: "flash", text: "Mezo testnet only: test funds, no real money." },
];

/**
 * The app opens only with a wallet connected. This is a UX boundary, not access control: every
 * number in the app is public on-chain anyway, and the public story lives on the landing and docs.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  // wagmi starts as "disconnected" until it has tried to restore the last session after mount, so
  // wait for that before deciding; otherwise returning users see the gate flash.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (status === "connected" || status === "disconnected") {
      const id = setTimeout(() => setSettled(true), status === "connected" ? 0 : 250);
      return () => clearTimeout(id);
    }
  }, [status]);

  if (status === "connected") return <>{children}</>;
  if (!settled) return <GateFrame><GateSkeleton /></GateFrame>;

  return (
    <GateFrame>
      <div className="relative mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          {/* A frozen crystal from Blender, over a soft frost glow (the glow alone if WebGL is off). */}
          <div className="relative h-44 w-44" aria-hidden>
            <div className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-frost-500/20 blur-2xl" />
            <CrystalScene />
          </div>
          <h1 className="display mt-3 text-4xl leading-[1.04] sm:text-5xl">
            <ScrambleText text="Connect to thaw." />
          </h1>
          <p className="mt-4 max-w-sm leading-relaxed text-mist-400">
            The app reads your locks and loans straight from your wallet. Connect one to borrow, lend or bid.
          </p>
          <div className="mt-8">
            <ConnectButton label="Connect wallet" />
          </div>
        </div>

        <SpotlightCard tilt={false} className="mt-10 p-5">
          <ul className="space-y-3.5">
            {PROMISES.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-sm text-mist-300">
                <Icon name={p.icon} size={18} className="mt-px text-frost-300" />
                {p.text}
              </li>
            ))}
          </ul>
        </SpotlightCard>

        <p className="mt-8 text-center text-sm text-mist-500">
          Just looking?{" "}
          <Link href="/docs" className="font-medium text-frost-300 underline-offset-4 hover:underline">
            Read how Thaw works
          </Link>
        </p>
      </div>
    </GateFrame>
  );
}

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div className="hero-glow relative flex min-h-screen flex-col">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Thaw home">
          <Wordmark size={24} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 items-center px-4 py-12">{children}</main>
    </div>
  );
}

function GateSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center" role="status" aria-label="Checking for a connected wallet">
      <span className="h-16 w-16 animate-pulse rounded-2xl bg-glacier-800" />
      <span className="mt-7 h-10 w-64 animate-pulse rounded-lg bg-glacier-800" />
      <span className="mt-4 h-4 w-72 animate-pulse rounded bg-glacier-800" />
      <span className="mt-8 h-11 w-40 animate-pulse rounded-xl bg-glacier-800" />
    </div>
  );
}
