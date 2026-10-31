# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (static site generation) with TradingView Lightweight Charts for candlestick and equity charts. Hosted on
Cloudflare Pages. Lives in `web/`, separate from the Python tester in the parent folder. Agreed with the owner in
discussion (2026-10-31): SSR and a client-side SPA were rejected because the data only changes when the tester runs.

## Users

- **Primary reader: retail traders.** They know candles, stops, take profit and TradingView. They do not need a
  candle explained, but they do need the method (fills, slippage, in-sample) explained in plain words.
- **The owner (Tupa).** Uses the site as a public journal of the research journey and shares links to it.

## Product Purpose

Tupa's Trading Terminal is a public research journal. It shows, in simple English, how each trading strategy on
CL1! (NYMEX WTI crude oil, 1-minute bars) was tested: what the strategy is, the rules and process used, and the
results. Success means a retail trader can follow a strategy from idea to result without reading code, and can
trust what the numbers do and do not claim.

## Positioning

The results come from a backtester built to match the TradingView Strategy Tester on CL1! 1m, with fixed and
published costs, separate slippage scenarios, an independent review and replication by Codex, and honest labels
(in-sample, best of N). Failed ideas are published too, not only winners.

## Operating Context

- Content source: the Python tester in the parent folder writes `results/<strategy>/` (CSV, JSON, JSONL) and
  `docs/strategies/<strategy>/` (Markdown, PNG). A Python export step turns these into JSON for the site.
- The site only displays numbers. It never recomputes metrics, so it cannot drift from `docs/ENGINE.md`.
- Explanatory prose is written by hand (MDX) and kept separate from generated numbers, so rerunning a test never
  overwrites the explanation.
- Features: Feature 1 (TradingView-style test of a strategy) and Feature 2 (optimization, development interval only)
  exist. Feature 3 is not built yet; the site must have a place for it that updates once it exists.

## Capabilities and Constraints

- Public, no authentication or authorization.
- **Candlestick visuals use fake or illustrative data only.** Real Databento market data must never be published.
- **Disclaimers on every results page:** in-sample, best of N where optimized, slippage scenario labels, not
  financial advice.
- Fixed test properties shown as-is: $50,000 capital, 1 contract, $2.01 per order ($4.02 round trip), slippage
  0 ticks plus separate 1 and 2 tick scenarios. Slippage is never called commission.
- CL only. MCL is never shown or suggested.
- Feature 2 numbers come from the development interval (before 2024-01-01). 2024+ is reserved, not clean
  out-of-sample.
- Owner rules that differ from TradingView (roll exit) are labelled as such.
- Owner commits by hand. Git remote: `git@github.com:mrullldhm/ttt.git`.

## Brand Commitments

- Name: **Tupa's Trading Terminal**.
- Voice: simple, understandable English. Short sentences. Plain words before jargon; explain each term once.
- Binding visual constraints from the owner: night mode first; a Graphite-style web design theme.

## Evidence on Hand

- Strategy tested: Fair Price Reversal (LuxAlgo 9:29 ET adaptation), three session variants (Asia, London, New
  York). Docs in `../docs/strategies/fair_price_reversal/`, raw results in `../results/fair_price_reversal/`.
- Feature 2 optimization runs: `../docs/strategies/fair_price_reversal/optimized/`, ledger in
  `../results/fair_price_reversal/ledger.jsonl`.
- Engine rules: `../docs/ENGINE.md`. Optimize rules: `../docs/OPTIMIZE.md`. Codex reviews: `../docs/REVIEWS.md`.
- Dead-end research worth journaling: daily Donchian breakout intraday, SSRN intraday CL survey.
- No testimonials, followers, performance track record or live trading results exist. Do not invent any.

## Product Principles

1. **Honest over impressive.** Every number carries its label: in-sample, best of N, slippage scenario.
2. **Explain the process, not only the result.** A reader should understand why a rule exists.
3. **Plain English first.** If a retail trader would stumble on a sentence, rewrite it.
4. **Display, never compute.** The tester is the single source of truth for numbers.
5. **The journey counts.** Failed strategies and dead ends are first-class entries.

## Accessibility & Inclusion

No product-specific requirement established beyond WCAG AA contrast on the dark theme and readable charts
(color is never the only way to tell long from short or win from loss).
