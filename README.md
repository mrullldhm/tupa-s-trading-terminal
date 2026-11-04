# Tupa's Trading Terminal (web)

Public research journal for the CL1! tester in the parent folder. Astro static site, Lightweight Charts, Cloudflare
Pages. Product rules: `PRODUCT.md`. Plan and Codex review: `PLAN.md`.

## Run
```bash
cd web
npm install
npm run export     # tester results -> src/data/strategies/*.json (uses ../.venv)
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run check      # type check
```

## Where things live
| Path | What |
|---|---|
| `tools/export_web.py` | Copies numbers from `../results` and `../docs`. Never recomputes. Field allowlist: no prices, no per-trade rows |
| `src/data/strategies/*.json` | Exporter output. Do not edit by hand |
| `src/data/verdicts.ts` | Hand-written Feature 2 run verdicts, with their source |
| `src/content/strategies/*.mdx` | Strategy pages: prose plus result components |
| `src/content/journal/*.mdx` | Journal entries |
| `src/lib/illustrative.ts` | Synthetic candles for the teaching chart. The build fails if the picture breaks the rules it teaches |
| `src/pages/method/` | How the tester works, how to read results |
| `public/_headers` | Cloudflare security headers (CSP: no inline scripts; keep `assetsInlineLimit: 0`) |
| `tools/test_export_web.py` | Exporter tests, from the repo root: `.venv/bin/python -m pytest web/tools/test_export_web.py` |

## Adding a strategy
1. Run the tester (`python -m tvtester.cli test <name>`), then add the name to the `export` script and run it.
2. Register the JSON in `src/lib/data.ts`.
3. Write `src/content/strategies/<slug>.mdx` (copy `fair-price-reversal.mdx`), with `stage: tested` and `dataKey`.
4. Feature 3: when the tester writes it, the exporter fills `features.f3`; replace the `<F3Pending>` block.

## Deploy (Cloudflare Pages)
Connect the GitHub repo, then: root directory `web`, build command `npm run build`, output directory `dist`.
The exporter is not run in CI (results stay local); commit the exported JSON instead.
Update `site` in `astro.config.mjs` once the real domain is known.

## Before going public
- Root `.gitignore` does not exclude `data/` (Databento parquet). `results/*/trades_*.csv` and
  `docs/strategies/*/README.md` contain real prices. A public repo would publish them. Keep the repo private, or
  keep those paths out of git.
- `src/lib/site.ts` links the Pine twin on GitHub. Set `REPO_URL` to `null` while the repo is private.

## Malaysia time and daily trade charts (localhost)

All display dates, chart axes, crosshairs and execution records use Asia/Kuala_Lumpur (MYT, UTC+8), regardless
of the browser timezone. Daily profit and month-end equity are grouped by the Malaysian calendar during export.
The tester's raw UTC timestamps and session logic remain unchanged. `day-my.json` records its timezone explicitly.

F1 sessions and F2 candidates show daily net profit directly, newest first. The latest 30 days are server-rendered;
“Show earlier days” fetches the existing daily export and adds another 30. No year/month/week drill-down is needed.

With `npm run dev` on localhost, click a day to open its real one-minute candles and simulated fills below that row.
Click it again to close. Charts use the baseline run with commission included. There is no execution-scenario selector.
The chart includes entry/exit markers, working stop and target paths, and the strategy's indicator series.
Working stop changes include breakeven/trailing when enabled in that result's configuration; settings and replay
notes explain which rules ran. Each day contains trades **closed** on that Malaysian date (MYT, UTC+8), including earlier entries.

`integrations/private-trade-replay.mjs` serves the private dev endpoint using `tools/trade_replay.py` and `../.venv/bin/python`.
The worker reads local parquet and saved CSV files, replays the exported configuration using the tester, and checks
every fill against the CSV before returning prices. The first chart for a configuration may take a while;
the most recent replay stays in memory for other days in that same result.
Missing data, changed exports, and fill mismatches show an error with a retry control. No tester outputs are modified.

Real prices are served only to loopback requests with a localhost Host and same-origin browser requests. The endpoint
is not included in the static build, and prices are never written to `public/` or `dist/`. Published pages retain
the daily P&L list. Public real-price charts remain pending confirmation that redistribution is permitted.

## Feature 1 metric rankings

The F1 section keeps the Graphite design and offers 13 separate objectives through a native metric selector.
It shows the selected settings, all their metrics, an all-winners comparison, month-end closed P&L and daily
results. Distinct objectives can share the same winning setting. All figures come from the tester.

Generate fresh full-grid results without replacing the historical reports, then export:

```bash
cd ..
.venv/bin/python -m tvtester.cli test tupa_trade --output-tag metrics --jobs 1
# Repeat for fair_price_reversal and supertrend_kalman as needed.
# --min-trades 30 and --ruin-loss 25000 declare selection eligibility and the estimated ruin loss threshold.
cd web
npm run export
npm run check
npm run build
```

The exporter uses the newest `metric_winners.json` from `results/<strategy>/metrics/<variant>/` or the default
variant directory and checks the winners against
their grids, summaries and trade totals. Missing multi-metric runs are visibly pending; the historical report
stays in a disclosure. No old grid is presented as a new-rule result. Metric daily results use Malaysia time,
and their verified real-price charts are available only on localhost, like the existing daily results.
