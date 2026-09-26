"use client";

import { useState } from "react";
import { shortAddress } from "@/lib/format";
import { Icon } from "./Icon";

const EXPLORER = "https://explorer.test.mezo.org";

export function AddressChip({ address, label }: { address: string | undefined; label: string }) {
  const [copied, setCopied] = useState(false);
  const missing = !address || /^0x0+$/.test(address);

  if (missing) return <span className="font-mono text-xs text-mist-500">Not deployed</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the explorer link still works.
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs text-frost-200">{shortAddress(address)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} address copied` : `Copy ${label} address`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-500 transition-colors hover:bg-glacier-800 hover:text-frostwhite"
      >
        <Icon name={copied ? "check" : "copy"} size={14} className={copied ? "text-success" : undefined} />
      </button>
      <a
        href={`${EXPLORER}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${label} on Mezo explorer`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-500 transition-colors hover:bg-glacier-800 hover:text-frostwhite"
      >
        <Icon name="external" size={14} />
      </a>
    </span>
  );
}
