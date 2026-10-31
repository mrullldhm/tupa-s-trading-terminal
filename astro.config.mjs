import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://tupas-trading-terminal.pages.dev",
  integrations: [mdx()],
  trailingSlash: "always",
  build: { format: "directory" },
  // Keep every script external so the CSP needs no inline-script allowance.
  vite: { build: { assetsInlineLimit: 0 } },
});
