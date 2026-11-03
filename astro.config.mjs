import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import localTradeReplay from "./integrations/private-trade-replay.mjs";

export default defineConfig({
  site: "https://tupas-trading-terminal.pages.dev",
  // Real execution charts are served only by the localhost development integration.
  integrations: [mdx(), localTradeReplay()],
  trailingSlash: "always",
  build: { format: "directory" },
  // Keep every script external so the CSP needs no inline-script allowance.
  vite: { build: { assetsInlineLimit: 0 } },
});
