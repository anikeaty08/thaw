import { Bot, InlineKeyboard } from "grammy";
import { isAddress, formatUnits, type Address } from "viem";
import { config } from "./config.js";
import { linkWallet, getLinkedWallet } from "./store.js";
import { fetchLoansForBorrower } from "./graphql.js";
import { readDebt, readHealthFactor } from "./chain.js";

function fmt(musd: bigint): string {
  return Number(formatUnits(musd, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function registerCommands(bot: Bot): void {
  bot.command("start", (ctx) =>
    ctx.reply(
      "Welcome to Thaw. Borrow MUSD against your locked veMEZO/veBTC — your weekly Mezo Earn rewards pay it back.\n\n" +
        "/connect <wallet address> - link your wallet\n" +
        "/loans - list your active loans\n" +
        "/quote <loanId> - current debt and health factor\n",
    ),
  );

  bot.command("connect", async (ctx) => {
    const arg = ctx.match?.toString().trim();
    if (!arg || !isAddress(arg)) {
      return ctx.reply("Usage: /connect 0xYourWalletAddress");
    }
    // Trust-on-first-use: this does not prove wallet ownership. Good enough for a hackathon demo;
    // production should require a signed message (e.g. SIWE) before linking a chat to an address.
    linkWallet(ctx.chat.id, arg as Address);
    await ctx.reply(`Linked ${arg} to this chat. Try /loans.`);
  });

  bot.command("loans", async (ctx) => {
    const wallet = getLinkedWallet(ctx.chat.id);
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
