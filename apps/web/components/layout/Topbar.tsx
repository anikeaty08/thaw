"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wordmark } from "@/components/ui/ThawMark";
import { NextHarvest } from "@/components/ui/NextHarvest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BackendStatus } from "@/components/ui/BackendStatus";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-glacier-700 bg-glacier-950/75 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-10 lg:py-4">
      <Link href="/" className="lg:hidden" aria-label="Thaw home">
        <Wordmark size={22} />
      </Link>
      <div className="hidden items-center gap-4 lg:flex">
        <NextHarvest variant="inline" />
        <BackendStatus />
      </div>
      <BackendStatus className="lg:hidden" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <ConnectButton
        label="Connect wallet"
        chainStatus="icon"
        accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          showBalance={false}
        />
      </div>
    </header>
  );
}
