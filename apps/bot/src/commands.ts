import { Bot, InlineKeyboard } from "grammy";
import { isAddress, formatUnits, type Address } from "viem";
import { config } from "./config.js";
import { createLinkCode, getLinkedWallet, unlinkWallet, LINK_CODE_TTL_MINUTES } from "./store.js";
import { fetchLoansForBorrower } from "./graphql.js";
import { readDebt, readHealthFactor } from "./chain.js";

function fmt(musd: bigint): string {
  return Number(formatUnits(musd, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function registerCommands(bot: Bot): void {
  // Linking a wallet is verified: the chat gets a one-time code, and the wallet must sign a message
  // containing it in the web app. Typing an address alone never links anything.
  async function sendLinkCode(chatId: number, reply: (text: string, other?: object) => Promise<unknown>): Promise<void> {
    const code = await createLinkCode(chatId);
    const shown = `${code.slice(0, 4)}-${code.slice(4)}`;
    const keyboard = new InlineKeyboard().url("Verify with your wallet", `${config.webappUrl}/link-telegram?code=${code}`);
    await reply(
      [
        "To get alerts for your loans, prove this wallet is yours.",
        "",
        "1. Tap the button below (it opens the Thaw app).",
        "2. Connect your wallet and sign the message. It's free: no transaction, no gas.",
        "",
        `Your code is ${shown}. It works once and expires in ${LINK_CODE_TTL_MINUTES} minutes.`,
        "If the button doesn't open, enter the code on the app's Telegram page.",
        "",
        "Never share this code with anyone.",
      ].join("\n"),
      { reply_markup: keyboard },
    );
  }

  bot.command("start", async (ctx) => {
    // "Get alerts on Telegram" in the app opens t.me/<bot>?start=link, which arrives as "/start link".
    if (ctx.match?.toString().trim() === "link") return sendLinkCode(ctx.chat.id, (t, o) => ctx.reply(t, o));
    return ctx.reply(
      [
        "Welcome to Thaw. Borrow MUSD against your locked veMEZO/veBTC — your weekly Mezo Earn rewards pay it back.",
        "",
        "/connect - link your wallet (verified with a free signature)",
        "/loans - list your active loans",
        "/quote <loanId> - current debt and health factor",
        "/unlink - stop alerts for this chat",
      ].join("\n"),
    );
  });

  bot.command("connect", (ctx) => sendLinkCode(ctx.chat.id, (t, o) => ctx.reply(t, o)));

  bot.command("unlink", async (ctx) => {
    const removed = await unlinkWallet(ctx.chat.id);
    await ctx.reply(
      removed ? "Unlinked. You won't get alerts here any more. Use /connect to link again." : "No wallet was linked to this chat.",
    );
  });

  bot.command("loans", async (ctx) => {
    const wallet = await getLinkedWallet(ctx.chat.id);
    if (!wallet) return ctx.reply("No wallet linked yet. Send /connect to link one.");

    const loans = await fetchLoansForBorrower(wallet);
    if (loans.length === 0) return ctx.reply("No active loans for this wallet.");

    const lines = loans.map((l) => {
      const flag = l.liquidating ? " ⚠️ LIQUIDATING" : "";
      return `#${l.id} (${l.mode}) — debt ${fmt(BigInt(l.principal))} MUSD${flag}`;
    });
    await ctx.reply(lines.join("\n"));
  });

  bot.command("quote", async (ctx) => {
    const arg = ctx.match?.toString().trim();
    if (!arg || !/^\d+$/.test(arg)) return ctx.reply("Usage: /quote <loanId>");

    const loanId = BigInt(arg);
    const [debt, hf] = await Promise.all([readDebt(loanId), readHealthFactor(loanId)]);
    const hfText = hf === 2n ** 256n - 1n ? "∞ (non-liquidating)" : (Number(hf) / 1e18).toFixed(2);

    const keyboard = new InlineKeyboard().url("Repay in app", `${config.webappUrl}/loans/${loanId}?action=repay`);
    await ctx.reply(`Loan #${loanId}\nDebt: ${fmt(debt)} MUSD\nHealth factor: ${hfText}`, { reply_markup: keyboard });
  });
}
