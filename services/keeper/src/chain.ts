import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

// Mezo testnet (docs/THAW_SYSTEM_DESIGN.md §6.1): London EVM, BTC gas token, no PUSH0.
export const mezoTestnet = defineChain({
  id: config.chainId,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

export const account = privateKeyToAccount(config.keeperPrivateKey);

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(config.rpcUrl),
});

export const walletClient = createWalletClient({
  account,
  chain: mezoTestnet,
  transport: http(config.rpcUrl),
});
