// Run with: npm test (tsx). Exercises the verified Telegram linking with real signatures against an
// in-memory stand-in for the two tables.
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { linkChat, linkMessage, createRateLimiter } from "../src/api/telegramLink.ts";

const owner = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());

// In-memory stand-in for the two tables, supporting only the statements linkChat issues.
const codes = new Map<string, { chat: string; expires: number }>();
const links = new Map<string, string>();
function makeSql(): any {
  const run = async (strings: TemplateStringsArray, ...v: any[]) => {
    const q = strings.join("?").replace(/\s+/g, " ").trim();
    if (q.startsWith("delete from bot_link_codes")) {
      const c = codes.get(v[0]);
      if (!c || c.expires <= Date.now()) return [];
      codes.delete(v[0]);
      return [{ chat_id: c.chat }];
    }
    if (q.startsWith("insert into bot_links")) { links.set(String(v[0]), v[1]); return []; }
    throw new Error("unexpected query: " + q);
  };
  (run as any).begin = async (fn: any) => fn(run);
  return run;
}
const sql = makeSql();
const sign = (acct: typeof owner, code: string, addr: string) => acct.signMessage({ message: linkMessage(code, addr) });
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " " + JSON.stringify(detail)}`); if (!cond) failed++; };

// 1. Happy path
codes.set("ABCD2345", { chat: "555", expires: Date.now() + 600_000 });
let r = await linkChat(sql, { code: "ABCD2345", address: owner.address, signature: await sign(owner, "ABCD2345", owner.address) });
check("valid signature links the chat", r.ok && links.get("555") === owner.address.toLowerCase(), r);
check("code is spent after use", !codes.has("ABCD2345"));

// 2. Replay of the same code and signature
r = await linkChat(sql, { code: "ABCD2345", address: owner.address, signature: await sign(owner, "ABCD2345", owner.address) });
check("a used code cannot be replayed", !r.ok && r.status === 410, r);

// 3. Someone signs for an address that isn't theirs: claims owner's address, signs with their own key
codes.set("EFGH6789", { chat: "666", expires: Date.now() + 600_000 });
r = await linkChat(sql, { code: "EFGH6789", address: owner.address, signature: await sign(stranger, "EFGH6789", owner.address) });
check("signature from a different wallet is rejected", !r.ok && r.status === 401, r);
check("a rejected signature does not burn the code", codes.has("EFGH6789"));
check("and links nothing", !links.has("666"));

// 4. Signature for one code reused with another code
codes.set("JKLM2345", { chat: "777", expires: Date.now() + 600_000 });
r = await linkChat(sql, { code: "JKLM2345", address: owner.address, signature: await sign(owner, "EFGH6789", owner.address) });
check("a signature made for another code is rejected", !r.ok && r.status === 401, r);

// 5. Tampered address
r = await linkChat(sql, { code: "JKLM2345", address: stranger.address, signature: await sign(owner, "JKLM2345", owner.address) });
check("a signature for a different address is rejected", !r.ok && r.status === 401, r);

// 6. Expired code
codes.set("NPQR2345", { chat: "888", expires: Date.now() - 1 });
r = await linkChat(sql, { code: "NPQR2345", address: owner.address, signature: await sign(owner, "NPQR2345", owner.address) });
check("an expired code is rejected", !r.ok && r.status === 410, r);

// 7. Malformed input
for (const [name, input] of [["no body", {}], ["short code", { code: "ABC", address: owner.address, signature: "0x" + "00".repeat(65) }], ["bad address", { code: "ABCD2345", address: "0x123", signature: "0x" + "00".repeat(65) }], ["bad signature", { code: "ABCD2345", address: owner.address, signature: "0xdead" }]] as const) {
  r = await linkChat(sql, input as any);
  check(`malformed input (${name}) is a 400`, !r.ok && r.status === 400, r);
}

// 8. Forgiving code entry (lowercase, dash)
codes.set("STUV2345", { chat: "999", expires: Date.now() + 600_000 });
r = await linkChat(sql, { code: "stuv-2345", address: owner.address, signature: await sign(owner, "STUV2345", owner.address) });
check("code typed in lowercase with a dash still works", r.ok, r);

// 9. Rate limiter
const allow = createRateLimiter(3, 1000);
check("rate limiter allows up to the limit then blocks", allow("a") && allow("a") && allow("a") && !allow("a") && allow("b"));
check("rate limiter resets after the window", allow("a", Date.now() + 2000));

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) FAILED`);
process.exit(failed ? 1 : 0);
