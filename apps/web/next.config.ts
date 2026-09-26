import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray lockfile in the user's home directory confuses Next's workspace-root detection.
  outputFileTracingRoot: path.join(import.meta.dirname),
  webpack: (config, { webpack }) => {
    // @coinbase/cdp-sdk (pulled in transitively by RainbowKit's Coinbase Smart Wallet connector,
    // via @base-org/account -> @wagmi/connectors) lazily imports a whole family of optional x402
    // payment subpackages (@x402/core, @x402/evm/*, @x402/svm/*, ...) behind a try/catch helper
    // at runtime. Webpack still tries to statically resolve each one at build time and fails since
    // none are installed (we don't use x402 payments) — ignore the entire @x402/* namespace rather
    // than whack-a-moling individual subpaths.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    // pino (via WalletConnect's logger) optionally pretty-prints logs in Node; unused in the
    // browser bundle and not installed, so webpack just needs to stop looking for it.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^pino-pretty$/ }));
    return config;
  },
};

export default nextConfig;
