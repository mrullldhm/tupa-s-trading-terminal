# Tupa's Trading Terminal (web)

Public research journal for the CL tester in the parent folder: can an intraday CL strategy pass the Topstep 50K
Trading Combine? Astro static site, no client framework, Cloudflare Pages. Product rules: `PRODUCT.md`.

## Run
```bash
cd web
npm install
npm run export     # ../results + ../docs -> src/data/research.json (uses ../.venv)
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run check      # type check
```

Run `npm run export:charts` to generate the historical setup charts from local CL bars and saved build trade logs.
The chart files stay in `../results/` and are available only on the loopback development server.
Use `npm run export:rlm-trades` to build the all-hours Reaction Level Matrix trade review from its saved run.

## Where things live
| Path | What |
|---|---|
| `tools/export_web.py` | Copies ledger stats, strategy status lines, and per-version sums of net P&L by month and year. No prices, no per-trade rows |
| `src/data/research.json` | Exporter output. Do not edit by hand |
| `src/data/strategies.ts` | Hand-written plain-English text per strategy (idea, rules, verdict). No numbers |
| `src/lib/data.ts` | Joins the two, defines the five dev gates shown on every page and fixed strategy colours |
| `src/pages/` | Overview, strategies (list + one page each), all test runs, Topstep rules, how we test, about |
| `src/lib/*.client.ts` | Chart crosshair and runs-table filter/sort. External scripts only (CSP) |
| `public/_headers` | Cloudflare security headers (CSP: no inline scripts; keep `assetsInlineLimit: 0`) |

## Adding a strategy
1. Write `../docs/strategies/<id>/README.md` with a `Status:` line, run the tester, then `npm run export`.
2. Add its text to `src/data/strategies.ts` and a colour in `src/lib/data.ts` (`COLORS`).
3. If it has a new parameter shape, add a version label in `variant_label()` in the exporter.

## Deploy (Cloudflare Pages)
Root directory `web`, build command `npm run build`, output directory `dist`. The exporter is not run in CI (results
stay local); commit the exported JSON instead.
