import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { mezoTestnet } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// With a WalletConnect project id (https://cloud.reown.com) every RainbowKit wallet is offered,
// including phone wallets over QR. Without one, WalletConnect can't start (it 403s on every load),
// so only browser-extension wallets are offered; installed ones like MetaMask still appear by name.
export const wagmiConfig: Config = projectId
  ? getDefaultConfig({ appName: "Thaw", projectId, chains: [mezoTestnet], ssr: true })
  : createConfig({
      chains: [mezoTestnet],
      transports: { [mezoTestnet.id]: http() },
      ssr: true,
      connectors: connectorsForWallets([{ groupName: "Browser wallet", wallets: [injectedWallet] }], {
        appName: "Thaw",
        projectId: "not-used-by-injected-wallets",
      }),
    });
