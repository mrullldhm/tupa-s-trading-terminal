import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tupas-trading-terminal.pages.dev",
  trailingSlash: "always",
  build: { format: "directory" },
  // Keep every script external so the CSP needs no inline-script allowance.
  vite: { build: { assetsInlineLimit: 0 } },
});
