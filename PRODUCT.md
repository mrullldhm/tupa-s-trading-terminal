# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro static site, no client framework and no chart library: charts are SVG drawn at build time, with two small
external scripts (chart crosshair and highlight, runs-table filter and sort). Hosted on Cloudflare Pages. Lives in
`web/`, its own git repo, separate from the Python tester in the parent folder. The data only changes when the tester
runs, so SSR and a client-side SPA are not needed.

## Users

- **Primary reader: retail traders.** They know candles, stops, take profit, TradingView and prop-firm challenges.
  They need the method (fills, fees, in-sample, best of N, the Combine rules) explained in plain words.
- **The owner (Tupa).** Uses the site as a public journal of the research and shares links to it.

## Product Purpose

Tupa's Trading Terminal is a public research journal for one question: **is there an intraday CL (NYMEX WTI crude
oil futures) strategy that passes the Topstep 50K Trading Combine consistently?** Ideas come from public sources
(articles, GitHub bots, shared documents), are rebuilt for CL, replayed on one-minute bars under strict fill rules,
then run through the Combine's rules. Success means a retail trader can follow each idea from source to verdict
without reading code, and can trust what the numbers do and do not claim.

## Positioning

Honest research, not a signal service. Every idea is tested the same way, failures are published, and every number
carries its label (in-sample, best of N, fees and fill rules). The current answer is "not yet", and the site says so
first.

## Operating Context

- Research reset on 2026-11-12. Work before that date (Fair Price Reversal, Tupa Trade, F0–F5 features, TradingView
  matching) is retired and not shown; it remains in git history.
- Content source: the tester writes `../results/ledger.csv` (one row per run, never deleted), trade lists in
  `../results/<strategy>/` and hypothesis/results docs in `../docs/strategies/<strategy>/README.md` (with a `Status:`
  line). `npm run export` turns these into `src/data/research.json`.
- The exporter copies ledger stats and status lines, and sums net profit per month and per year for the newest run
  of each version. It never re-runs a backtest and never publishes prices or per-trade rows.
- Plain-English text per strategy (idea, rules, verdict, lessons) is hand-written in `src/data/strategies.ts`,
  separate from numbers, so a re-run never overwrites the explanation.
- Research stages: Build (dev, 2010-06 to 2021-12), Check (validation, 2022–2024, one frozen run), Final exam
  (holdout, 2025 to 2026-11-12, once per strategy), Live paper (new data only). The owner studied every year before
  the reset, so only forward data is truly unseen; the site says this.
- Five dev checks (from `../docs/PROTOCOL.md`, proposed, owner may change): 200+ trades, profit factor 1.25+, 70%+
  years in profit, Combine rolling pass rate 50%+, sequential cost per pass $500 or less. The "best version" of an
  idea is the one passing the most checks, then the highest profit factor.

## Capabilities and Constraints

- Public, no authentication.
- Dates display in Malaysia time (Asia/Kuala_Lumpur).
- Real Databento market data (prices, candles) must never be published without separate redistribution
  authorization. Only aggregates (net $ by month and year, counts) are published.
- On the loopback development server, each strategy page shows an interactive CL chart around a saved backtest trade.
  `npm run export:charts` verifies the trade against the current strategy code and writes its historical candles to
  the local results directory. Public builds exclude those charts and candles.
- **Disclaimers on every page:** in-sample, best of N, fill and fee assumptions, not financial advice.
- Fixed test properties: 1 CL contract unless a strategy sizes up (max 5), $4.04 fee per round trip, limit entries
  that fill on a touch, no exit slippage, flat by 3:10 PM CT.
- Topstep values marked VERIFY in `../cltester/config.py` are unconfirmed and must be shown as "Not yet confirmed",
  never as official.
- CL only. MCL is never shown or suggested (owner rule, syariah).
- Owner commits by hand. Git remote: `git@github.com:mrullldhm/ttt.git`.

## Brand Commitments

- Name: **Tupa's Trading Terminal**.
- Voice: simple, understandable English. Short sentences. Plain words before jargon; explain each term where the
  number is read.
- Binding visual constraints from the owner (2026-11-13): night mode first; visual language modelled on the LuxAlgo
  web app (look only: no LuxAlgo logo, name, font or copy); feel of a modern professional financial SaaS.

## Evidence on Hand

- Six strategies tested on dev, all dropped: Yesterday's High and Low (purple_pa), RSI Strength Push (swapnil_hm),
  Stretch Back to the Average (xtley_gap), Two Candles in a Row (swapnil_momentum), Supertrend + EMA + Vortex
  (scribd_supertrend), ICT Confluence Score (ict_ea). 17 versions, 60 ledger rows.
- Rules: `../docs/PROTOCOL.md`, `../docs/ENGINE.md`, `../docs/TOPSTEP.md`, `../docs/SWINGS.md`.
- No testimonials, followers, performance track record or live trading results exist. Do not invent any.

## Product Principles

1. **Honest over impressive.** Every number carries its label. Money is shown in neutral ink with its sign; green
   and red mean pass and fail, not "looks good".
2. **Answer first.** Lead with the current answer and the closest attempt, then the evidence.
3. **Explain the process, not only the result.** A reader should understand why a rule or check exists.
4. **Plain English first.** If a retail trader would stumble on a sentence, rewrite it.
5. **The journey counts.** Failed strategies are first-class entries, each with what it taught.

## Accessibility & Inclusion

WCAG AA contrast on the dark theme. Colour is never the only signal: pass/fail carries an icon and label, money
carries its sign, charts have a table or text alternative.
