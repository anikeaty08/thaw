import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.test.mezo.org";

// docs/THAW_SYSTEM_DESIGN.md §6.1: London EVM, BTC gas token, no PUSH0.
export const mezoTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31611),
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
  testnet: true,
});
