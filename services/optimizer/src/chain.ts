import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

export const mezoTestnet = defineChain({
  id: config.chainId,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

export const account = privateKeyToAccount(config.optimizerPrivateKey);

export const publicClient = createPublicClient({ chain: mezoTestnet, transport: http(config.rpcUrl) });
export const walletClient = createWalletClient({ account, chain: mezoTestnet, transport: http(config.rpcUrl) });
