# Tupa's Trading Terminal: build plan (draft for Codex review)

Status: draft v2, 2026-10-31, revised after Codex review 1 (section 8). Product truth: `web/PRODUCT.md`. Nothing built yet.

## 1. Decisions already made by the owner
| Decision | Value |
|---|---|
| Stack | Astro SSG, TradingView Lightweight Charts, Cloudflare Pages |
| Folder | `web/` only. The tester (`tvtester/`, `strategies/`, `results/`, `docs/`) is never edited by the site build |
| Reader | Retail traders (know candles, stops, TradingView). Simple English |
| First job | Jump to a strategy |
| Visual world | graphite.com style, night mode. Direction: "Tilted Terminal" (below) |
| Candles | Fake / illustrative data only. Real Databento bars are never published |
| Disclaimers | Every results page: in-sample, best of N, slippage scenario, not financial advice |
| Must not feel | academic, plain/bloggy, hype/signal-seller, dense dashboard |

## 2. Architecture
```
tvtester (Python, parent folder)        web/ (Astro)
  results/<s>/*/summary.json   ─┐
  results/<s>/*/trades_*.csv   ─┼─► tools/export_web.py ─► web/src/data/<s>/*.json ─► astro build ─► web/dist
  results/<s>/ledger.jsonl     ─┤        (read-only on the tester)                        │
  docs/strategies/<s>/*.md     ─┘                                                         ▼
web/src/content/strategies/<s>.mdx  (hand-written prose, simple English)  ──────────► Cloudflare Pages
web/src/data/illustrative/*.json    (synthetic candles, labelled)
```
- **Display, never compute.** `export_web.py` copies numbers the tester already produced. The only transforms:
  rename keys, round for display, downsample the equity curve (cum_profit per trade) to ≤ 600 points, and drop
  columns we do not publish.
- **Prose never overwritten.** MDX is hand-written. Numbers enter MDX only through components that read the
  exported JSON (`<Result variant="ny" slippage={1} metric="net_profit" />`).
- **Feature 3 slot.** Each strategy JSON has `features: { f1: {...}, f2: {...}, f3: null }`. The page renders a
  "Not built yet" panel when `f3` is null; once the tester writes feature-3 output, the exporter fills it.
- `export_web.py` lives at `web/tools/export_web.py` (stdlib + pandas from the tester's venv). It fails loudly if
  any expected file is missing or if any symbol other than CL appears (`raw_symbol` must start with `CL`, never
  `MCL`).

### What gets published (field allowlist, see 8.2)
- **Owner decision (2026-10-31): summaries only.** No per-trade rows public. Publish scenario metrics, run
  metadata and a downsampled cumulative closed-trade P&L curve only.
- Never published: `entry_price`, `exit_price`, `raw_symbol`, any `*_pct` field derived from prices
  (`profit_pct`, `run_up_pct`, `drawdown_pct` reconstruct entry price), raw CSVs, report Markdown with prices.
- The exporter uses an explicit allowlist per output file; anything not listed is dropped and logged.

### Exporter inputs (explicit joins, reject on mismatch)
| Output | Source |
|---|---|
| F1 scenario metrics (0/1/2 ticks, each its own trades, net, PF, DD...) | `results/<s>/<v>/summary.json` |
| F1 winning parameters + grid size | `results/<s>/<v>/grid.csv` (top row by net at 0 ticks; row count = N) |
| F1 by-year table | copied from the existing report table; never re-aggregated |
| F2 runs (objective, sampler, seed, trials, verdict) | `results/<s>/ledger.jsonl` + `strategies/configs/*.json` |
| F2 replay metrics | `results/<s>/replay/<run>/summary.json` |
| Review evidence | `docs/REVIEWS.md` entries, by id (R3, R6...) |
Each export record carries source path, sha256, run id, interval, scenario, export version.

## 3. Information architecture
| Route | Purpose |
|---|---|
| `/` | Home: thesis headline, glowing illustrative candle sculpture, the tilted strategy index (main action) |
| `/strategies/` | Full catalog (same rows, flat), filter by status |
| `/strategies/<slug>/` | Strategy page (see 4) |
| `/strategies/<slug>/<variant>/` | Optional deep page per session (asia/london/ny) with full Feature-1 report (no trade table) |
| `/method/how-to-read/` | How to read the results: 0 ticks still pays $4.02 commission; limits never slip; scenarios are separate runs; objective (net1, includes open P&L) vs closed net profit; non-annualized Sharpe; drawdown % of initial capital, intrabar; buy-and-hold comparator has roll gaps; margin calls 0 because margin is not checked; in-sample, best of N, reserved ≠ clean OOS |
| `/strategies/<slug>/evidence/` | Stable evidence: protocol, exposure history, all runs with verdicts, scoped reviews with dates |
| `/method/` | How the tester copies TradingView: fills, intrabar path, costs, slippage, sessions, roll rule (labelled as owner rule), dev vs reserved interval, "in-sample" and "best of N" in plain words |
| `/journal/` | Dated entries: wins, dead ends (Donchian intraday, SSRN survey), reviews |
| `/journal/<slug>/` | Entry |
| `/about/` | Who, why CL only, Codex as reviewer, disclaimers in full |

Navigation: top bar (Strategies · Method · Journal · About). Strategy pages get a left "on this page" rail.

## 4. Strategy page anatomy (Fair Price Reversal first)
1. **Header**: name, one-line idea, status chips (Feature 1 ✓ · Feature 2 ✓ · Feature 3 pending · Code reviewed ·
   scoped replication badges, e.g. "Replicated: NY F1, 0/1 tick", each linking to its dated review). Never a
   blanket "Codex reviewed"; never imply TradingView parity without a TradingView export.
2. **The idea in plain words** (MDX) + **annotated illustrative chart** (Lightweight Charts, synthetic 1m candles):
   anchor candle body shaded as "fair price", ATR excursion, swing high, MSS break, entry, stop, target. Badge:
   "Illustrative data, not real prices". Step-through: Next/Prev reveals each step.
3. **Rules**: entry, stop, target options, session end, costs. Table of the three sessions with Malaysia time.
4. **Feature 1 results**: per session tab; top combination only; scenario table 0/1/2 ticks side by side; equity
   curve; by-year bars. Banner: "In-sample. Best of 192 combinations. Not financial advice." Honest callout
   (verified by Codex from summary.json): every session's 0-tick top combination lost money at 1 tick over the
   F1 interval (Asia −5,657, London −33,338, NY −20,100). Curve label: "Cumulative closed-trade P&L", excludes
   open swings; drawdown is never read off the chart.
5. **Feature 2 results**: every run (6) with its verdict and reason (candidate / rejected: no eligible trial,
   failed neighbourhood check...), objective net1 vs closed net, 300-trade eligibility rule, concentration notes
   (London 2022 = 58% of 1-tick profit). Budget shown both ways: this run's N and cumulative (500 trials per
   session, 1,500 total, plus 192-combination F1 grids). Trials ≠ engine evaluations. Fixed disclosure: "Evaluated
   before 2024. Baseline selection and an early filter check already used 2024+ data. Reserved does not mean clean
   out-of-sample."
6. **Feature 3**: placeholder panel.
7. **Review trail**: Codex review summary + date, link to log hash.
8. **Pine twin**: link to the `.pine` on GitHub.

## 5. Visual direction contract (Tilted Terminal)
- World: graphite.com grammar. Near-black ground (~#070707), off-white text (L≈98), secondary text 60% alpha,
  1px low-alpha borders, framed product panels with inner bezel, glowing white line art, light primary button with
  faint iridescent rim. Type: Geist (OFL, close to Graphite's licensed Matter) + Geist Mono for numbers/labels.
- Colour for P&L: not red/green only; sign (+/−), arrow glyph and position always carry meaning too. One muted
  long/short hue pair, desaturated to sit in the monochrome world.
- Home first viewport: headline left, glowing candlestick sculpture right (SVG, synthetic), the tilted frame
  begins below the fold line. Scroll-driven animation (CSS `animation-timeline: view()`) rotates the frame from
  `rotateX(28deg)` to flat. Fallback: flat, no animation (`prefers-reduced-motion`, no support, phones < 720px).

## 6. Build steps
1. Scaffold Astro in `web/` (TypeScript strict, no UI framework; Lightweight Charts as a client island).
2. Tokens + base layout + nav + footer disclaimer.
3. `export_web.py` + schema (zod in Astro content collections validates the JSON at build time).
4. Illustrative candle generator (seeded, deterministic) + annotated chart component.
5. Home, catalog, strategy page, method, journal (2 seed entries), about.
6. Build, screenshot desktop + mobile, one fix batch, Impeccable finish review, DESIGN.md.
7. Cloudflare Pages config notes (build command `npm run build`, root `web/`, output `dist`). Owner connects.

## 7. Questions for Codex
1. Any number on the planned pages that could misstate what the tester proves (labels, in-sample, best of N,
   lineage note that F1 baselines saw the reserved interval)?
2. Is dropping prices from published trades enough to avoid redistributing Databento data?
3. Exporter: any field in `summary.json` / `ledger.jsonl` whose meaning a reader would get wrong without context?
4. Anything in the IA that should exist but does not (e.g. a "How to read these numbers" page)?

## 8. Codex review 1 (2026-10-31): resolutions
| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | High | "Development interval only" hides selection exposure to 2024+ | Fixed disclosure beside every F2 result (section 4.5) |
| 2 | High | Dropping prices ≠ licence to publish trades; `*_pct` reconstructs price | Allowlist, no `*_pct`, no per-trade rows until owner decides (2) |
| 3 | High | "Best of N" understates cumulative search | Local + cumulative budget; trials vs evaluations (4.5) |
| 4 | High | "Codex reviewed" chip too broad | Code reviewed + scoped replication badges (4.1) |
| 5 | Med | Exporter lacks sources for params, by-year, replays | Explicit input table with provenance (2) |
| 6 | Med | Cum P&L curve ≠ equity / drawdown | Labelled closed-trade P&L, extrema kept when downsampling (4.4) |
| 7 | Med | Scenario/objective/metric meanings | Per-scenario metrics + How-to-read page (3) |
| 8 | Med | Runs need verdicts + history | All 6 runs with verdicts, evidence route (3, 4.5) |
| 9 | Med | No results-reading guide or evidence home | `/method/how-to-read/`, `/strategies/<s>/evidence/` (3) |

Verified by Claude: REVIEWS.md R3 (NY F1, 0/1 tick) and R6 (NY E2, 0/1 tick) are the only independent
replications; `results/<s>/replay/` holds the 6 F2 runs.
