"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { buttonClasses } from "./Button";
import { TELEGRAM_START_LINK } from "@/lib/telegram";

/**
 * Entry point for Telegram alerts. Linking is verified: the bot gives the chat a one-time code, and
 * the wallet signs a message with it on the link page, so nobody can attach an address they don't own.
 */
export function TelegramAlerts() {
  return (
    <section aria-label="Telegram alerts" className="frost-panel mt-6 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span className="icon-tile h-10 w-10 rounded-lg">
          <Icon name="telegram" size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-frostwhite">Get alerts on Telegram</p>
          <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-mist-400">
            A repayment report after every Thursday harvest, and a warning if a loan gets close to liquidation. You prove the
            wallet is yours with a free signature, so nobody else can link it. Stop any time with{" "}
            <span className="font-mono text-xs">/unlink</span>.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a href={TELEGRAM_START_LINK} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
          Link in Telegram
          <Icon name="external" size={14} />
          <span className="sr-only"> (opens Telegram in a new tab)</span>
        </a>
        <Link href="/link-telegram" className="px-2 py-2 text-sm text-mist-400 underline-offset-4 hover:text-frostwhite hover:underline">
          Have a code?
        </Link>
      </div>
    </section>
  );
}
