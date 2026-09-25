import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mezoTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Thaw",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "thaw-dev-placeholder",
  chains: [mezoTestnet],
  ssr: true,
});
