import { defineConfig } from "astro/config";

const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export default defineConfig({
  site: "https://tupas-trading-terminal.pages.dev",
  trailingSlash: "always",
  build: { format: "directory" },
  server: { host: "localhost" },
  // Keep every script external so the CSP needs no inline-script allowance.
  vite: {
    build: { assetsInlineLimit: 0 },
    plugins: [{
      name: "local-historical-chart",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const listener = server.httpServer?.address();
          const forwarded = Object.keys(request.headers).some((name) =>
            name === "forwarded" || name === "via" || name === "x-real-ip" || name.startsWith("x-forwarded-"));
          const allowHistoricalChart = !!listener && typeof listener !== "string"
            && loopback.has(listener.address) && loopback.has(request.socket.remoteAddress) && !forwarded;
          // Astro's dev server reads these locals from the incoming Node request.
          const locals = Symbol.for("astro.locals");
          // Astro strips query strings from prerendered routes, including in the dev server.
          const rlmTradeQuery = allowHistoricalChart
            && request.url?.startsWith("/strategies/reaction-level-matrix/all-hours/?")
            ? request.url.slice(request.url.indexOf("?") + 1) : undefined;
          const tupaSetupQuery = allowHistoricalChart
            && request.url?.startsWith("/strategies/tupa-1/setups/?")
            ? request.url.slice(request.url.indexOf("?") + 1) : undefined;
          request[locals] = { ...request[locals], allowHistoricalChart, rlmTradeQuery, tupaSetupQuery };
          next();
        });
      },
    }],
  },
});
