"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import clsx from "clsx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AddressChip } from "@/components/ui/AddressChip";
import { CODE_PATTERN, TELEGRAM_BOT, TELEGRAM_START_LINK, linkMessage, normalizeCode, submitLink, type LinkError } from "@/lib/telegram";

const ERRORS: Record<LinkError | "rejected", string> = {
  bad_request: "That code doesn't look right. It has 8 letters and numbers.",
  bad_signature: "The signature didn't match this wallet and code. Try again.",
  code_expired: "That code has expired or was already used. Send /connect to the bot for a new one.",
  rate_limited: "Too many tries. Wait a minute and try again.",
  unavailable: "The link service isn't available right now. Try again in a minute.",
  network: "Couldn't reach the server. Check your connection and try again.",
  rejected: "You declined the signature, so nothing was linked.",
};

function LinkTelegram() {
  const params = useSearchParams();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [code, setCode] = useState(() => normalizeCode(params.get("code") ?? ""));
  const [state, setState] = useState<"idle" | "signing" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const valid = CODE_PATTERN.test(code);
  const busy = state === "signing" || state === "sending";
  const message = address && valid ? linkMessage(code, address) : null;

  async function link() {
    if (!address || !message) return;
    setError(null);
    setState("signing");
    let signature: string;
    try {
      signature = await signMessageAsync({ message });
    } catch {
      setState("idle");
      setError(ERRORS.rejected);
      return;
    }
    setState("sending");
    const result = await submitLink({ code, address, signature });
    if (result.ok) {
      setState("done");
    } else {
      setState("idle");
      setError(ERRORS[result.error]);
    }
  }

  if (state === "done") {
    return (
      <div className="frost-panel mt-8 px-6 py-8 text-center" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
          <Icon name="check" size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-frostwhite">Linked</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-mist-400">
          Your Telegram chat will now get alerts for this wallet. Go back to Telegram and send <span className="font-mono text-xs">/loans</span> to
          check. Send <span className="font-mono text-xs">/unlink</span> any time to stop.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-frost-300 underline-offset-4 hover:underline">
            Open @{TELEGRAM_BOT}
          </a>
          <Link href="/portfolio" className="text-sm text-mist-400 underline-offset-4 hover:text-frostwhite hover:underline">
            Back to Portfolio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="frost-panel px-5 py-5 sm:px-6" aria-labelledby="step-code">
        <ol className="space-y-5 text-sm text-mist-300">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-glacier-600 font-mono text-xs text-mist-400">1</span>
            <span>
              In Telegram, send <span className="font-mono text-xs">/connect</span> to the bot.{" "}
              <a href={TELEGRAM_START_LINK} target="_blank" rel="noreferrer" className="text-frost-300 underline-offset-4 hover:underline">
                Open @{TELEGRAM_BOT}
              </a>
              . It replies with a one-time code.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-glacier-600 font-mono text-xs text-mist-400">2</span>
            <div className="min-w-0 flex-1">
              <label id="step-code" htmlFor="code" className="font-medium text-frostwhite">
                Enter the code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 8))}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD2345"
                aria-invalid={code.length > 0 && !valid}
                className="field mt-2 w-full font-mono text-lg uppercase tracking-[0.25em]"
              />
              {code.length > 0 && !valid && <p className="mt-1.5 text-xs text-mist-500">8 characters: letters (no I or O) and the numbers 2–9.</p>}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-glacier-600 font-mono text-xs text-mist-400">3</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-frostwhite">Sign with your wallet</p>
              <p className="mt-1 text-mist-400">
                Free. It sends no transaction and costs no gas. The signature only proves this wallet is yours.
              </p>
              <Button onClick={link} disabled={!valid || !address || busy} className="mt-3 w-full sm:w-auto">
                {state === "signing" ? "Confirm in your wallet…" : state === "sending" ? "Linking…" : "Sign and link"}
              </Button>
              {error && (
                <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger">
                  <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          </li>
        </ol>
      </section>

      <section className="frost-panel px-5 py-5 sm:px-6" aria-label="What you are signing">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">What you're signing</h2>
          {address && <AddressChip address={address} label="Connected wallet" />}
        </div>
        <pre
          className={clsx(
            "mt-4 whitespace-pre-wrap break-words rounded-xl border border-glacier-700 bg-glacier-950/60 p-4 font-mono text-xs leading-relaxed",
            message ? "text-mist-300" : "text-mist-500",
          )}
        >
          {message ?? "Enter your code to see the exact message your wallet will ask you to sign."}
        </pre>
        <ul className="mt-4 space-y-2 text-sm text-mist-400">
          <li className="flex gap-2">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-frost-300" />
            The code ties the signature to your Telegram chat, and the signature ties it to your wallet.
          </li>
          <li className="flex gap-2">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-frost-300" />
            The code works once and expires in 10 minutes. Never share it.
          </li>
          <li className="flex gap-2">
            <Icon name="eye" size={16} className="mt-0.5 shrink-0 text-frost-300" />
            Alerts only use public on-chain data.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function LinkTelegramPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Telegram" title="Link your chat" description="Get repayment reports and health warnings in Telegram, for the wallet you're connected with." />
      <Suspense fallback={null}>
        <LinkTelegram />
      </Suspense>
    </div>
  );
}
