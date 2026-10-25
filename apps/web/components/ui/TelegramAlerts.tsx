"use client";

import { useAccount } from "wagmi";
import { Icon } from "./Icon";
import { buttonClasses } from "./Button";
import { telegramLink, TELEGRAM_BOT } from "@/lib/telegram";

/**
 * One tap from the app into the Thaw bot, already pointed at the connected wallet. Says plainly
 * what the link does: the bot is told which address to watch and only reads public on-chain data.
 */
export function TelegramAlerts() {
  const { address } = useAccount();
  if (!address) return null;

  return (
    <section aria-label="Telegram alerts" className="frost-panel mt-6 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span className="icon-tile h-10 w-10 rounded-lg">
          <Icon name="telegram" size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-frostwhite">Get alerts on Telegram</p>
          <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-mist-400">
            A repayment report after every Thursday harvest, and a warning if a loan gets close to liquidation. The bot
            only reads public on-chain data, and <span className="font-mono text-xs">/unlink</span> stops it any time.
          </p>
        </div>
      </div>
      <a
        href={telegramLink(address)}
        target="_blank"
        rel="noreferrer"
        className={`${buttonClasses({ variant: "secondary" })} shrink-0`}
      >
        Open @{TELEGRAM_BOT}
        <Icon name="external" size={14} />
        <span className="sr-only"> (opens Telegram in a new tab)</span>
      </a>
    </section>
  );
}
