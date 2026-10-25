import { Bot, InlineKeyboard } from "grammy";
import { isAddress, formatUnits, type Address } from "viem";
import { config } from "./config.js";
import { linkWallet, getLinkedWallet, unlinkWallet } from "./store.js";
import { fetchLoansForBorrower } from "./graphql.js";
import { readDebt, readHealthFactor } from "./chain.js";

function fmt(musd: bigint): string {
  return Number(formatUnits(musd, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx) => {
    // The "Get alerts on Telegram" button in the app opens t.me/<bot>?start=<wallet address>, which
    // arrives here as "/start 0x…". Link that address to this chat.
    const payload = ctx.match?.toString().trim();
    if (payload && isAddress(payload)) {
      await linkWallet(ctx.chat.id, payload as Address);
      return ctx.reply(
        `You're set. This chat will get Thaw alerts for ${payload}:\n` +
          "• a repayment report after each Thursday harvest\n" +
          "• a warning if a loan's health gets close to liquidation\n\n" +
          "Alerts only use public on-chain data. Not your wallet? Send /unlink.\n" +
          "Try /loans to see your open loans.",
      );
    }
    return ctx.reply(
      "Welcome to Thaw. Borrow MUSD against your locked veMEZO/veBTC — your weekly Mezo Earn rewards pay it back.\n\n" +
        "/connect <wallet address> - link your wallet\n" +
        "/loans - list your active loans\n" +
        "/quote <loanId> - current debt and health factor\n" +
        "/unlink - stop alerts for this chat\n",
    );
  });

  bot.command("unlink", async (ctx) => {
    const removed = await unlinkWallet(ctx.chat.id);
    await ctx.reply(
      removed ? "Unlinked. You won't get alerts here any more. Use /connect to link again." : "No wallet was linked to this chat.",
    );
  });

  bot.command("connect", async (ctx) => {
    const arg = ctx.match?.toString().trim();
    if (!arg || !isAddress(arg)) {
      return ctx.reply("Usage: /connect 0xYourWalletAddress");
    }
    // Trust-on-first-use: this does not prove wallet ownership. Good enough for a hackathon demo;
    // production should require a signed message (e.g. SIWE) before linking a chat to an address.
    await linkWallet(ctx.chat.id, arg as Address);
    await ctx.reply(`Linked ${arg} to this chat. Try /loans.`);
  });

  bot.command("loans", async (ctx) => {
    const wallet = await getLinkedWallet(ctx.chat.id);
    if (!wallet) return ctx.reply("No wallet linked yet. Run /connect <address> first.");

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
