---
target: web site
total_score: 25
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
timestamp: 2026-10-31T14-02-28Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector+browser) + Codex technical audit

Heuristics: 1=3 2=2 3=3 4=3 5=3 6=2 7=n/a 8=3 9=3 10=3 → 25/36 (Good, 69%)

Design specificity: authored for this product (honesty vocabulary, slippage scenario table, hatched F3). Hero is the least specific part.
Detector: src clean; dist 17 (1 deliberate font, 15 false-positive colors). Browser: line-length 85-131 chars (68ch in Geist ≈ 90 chars), step dots 22px, table-scroll flush.

Priority issues:
- [P0] ScenarioTable mobile: .full display:none + .short aria-hidden → screen readers hear empty result cells (ScenarioTable.astro:50,87-95)
- [P1] Mobile hides honesty context: hints (after commission, monthly Sharpe) and drawdown % removed under 640px
- [P1] F1/F2/F3 internal names leak to readers; legend hidden <900px (StrategyIndex.astro:203)
- [P1] Exporter allowlist has nested bypass (exit_reasons, params copied wholesale) (tools/export_web.py:150)
- [P2] Strategy page first number ~2400px down; drawdown >100% of capital unexplained
- [P2] F2Runs throws on null f2, renders "( tries)" on empty runs; journal links lack planned guard
- [P2] Charts have no text alternative; lightweight-charts statically imported (57KB gz)
Minor: breadcrumb ends on "/", TOC aria-current="true", sr text "not-started", header pill touches edge on mobile, MCL named in about.mdx:15, hero "the TradingView way" overclaims vs unproven parity.
