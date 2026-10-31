---
name: Tupa's Trading Terminal
description: Night-only CL1! strategy research journal in a graphite near-black world, with honest labels as first-class UI.
colors:
  ground: "#070707"
  ground-raise: "#0c0c0d"
  control-hover: "#2a2a2f"
  button-light-top: "#f4f4f4"
  button-light-bottom: "#dcdcdc"
  panel: "#111112"
  panel-2: "#17171a"
  panel-3: "#1f1f23"
  ink: "#f9f9f9"
  ink-2: "rgb(249 249 249 / 0.66)"
  ink-3: "rgb(249 249 249 / 0.5)"
  line: "rgb(255 255 255 / 0.075)"
  line-2: "rgb(255 255 255 / 0.12)"
  line-3: "rgb(255 255 255 / 0.2)"
  long: "#8fd4c1"
  long-dim: "rgb(143 212 193 / 0.14)"
  short: "#e7a39d"
  short-dim: "rgb(231 163 157 / 0.14)"
  amber: "#e9c98a"
  amber-dim: "rgb(233 201 138 / 0.12)"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3.6vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  lede:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  lede-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  prose:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
  data:
    fontFamily: "Geist Mono Variable, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
rounded:
  tick: "2px"
  code: "5px"
  focus: "4px"
  nav: "8px"
  badge: "6px"
  tab: "7px"
  button: "9px"
  md: "10px"
  lg: "16px"
  screen: "12px"
  frame: "20px"
spacing:
  xs: "0.35rem"
  sm: "0.75rem"
  md: "1.25rem"
  lg: "2rem"
  xl: "4rem"
  wrap: "1180px"
  measure: "68ch"
components:
  button-primary:
    backgroundColor: "#f4f4f4"
    textColor: "#0a0a0a"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 1.15rem"
  button-primary-hover:
    backgroundColor: "#ffffff"
  button-quiet:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "44px"
    padding: "0 1.15rem"
  button-quiet-hover:
    backgroundColor: "{colors.panel-3}"
  badge:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.badge}"
    height: "24px"
    padding: "0 0.55rem"
  badge-rejected:
    backgroundColor: "{colors.short-dim}"
    textColor: "{colors.short}"
  badge-warn:
    backgroundColor: "{colors.amber-dim}"
    textColor: "{colors.amber}"
  callout:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "1rem 1.15rem"
  frame-screen:
    backgroundColor: "{colors.ground-raise}"
    rounded: "{rounded.frame}"
    padding: "10px"
  tab-selected:
    backgroundColor: "{colors.panel-3}"
    textColor: "{colors.ink}"
    height: "34px"
    padding: "0 1rem"
---

# Design System: Tupa's Trading Terminal

## Overview

**Creative North Star: "The Tilted Terminal"**

A research journal that behaves like a quiet instrument panel. The grammar is borrowed from graphite.com: a near-black ground, off-white ink that steps down through alpha instead of through new greys, 1px low-alpha hairlines, product shown inside a bezelled frame, glowing white line art, and a light primary button with a faint iridescent rim. The first screen leads with "jump to a strategy": headline and two actions on the left, a glowing candle sculpture on the right, and the strategy terminal rising from the fold tilted, then straightening as you scroll.

The system is night mode only (`color-scheme: dark`, theme-color `#070707`). There is no light theme and none is planned. Density is calm: wide gaps, long measures capped at 68ch, data in tables and mono. Trust is part of the look. Labels such as in-sample, best of N, slippage scenario and "Illustrative prices" are components, not footnotes.

**Key Characteristics:**
- Monochrome world; the only hues are desaturated long (mint), short (rose) and amber (caution).
- Structure comes from 1px alpha rules and inset rings, never from heavy fills or border-left stripes.
- Geist for words, Geist Mono for numbers and data only.
- One authored motion, on the home page only.
- Honesty labels are first-class vocabulary.

## Colors

A graphite scale of five grounds, one ink with two alpha steps, three hairline strengths, and three desaturated signal colors.

### Primary
- **Off-White Ink** (#f9f9f9): all primary text, active states, focus ring, glowing line art. There is no brand accent colour; ink is the accent.

### Secondary
- **Mint Long** (#8fd4c1): long side, positive numbers (`.pos`), long price lines and the long equity curve. Its dim tint (14% alpha) is the matching fill.
- **Rose Short** (#e7a39d): short side, negative numbers (`.neg`), rejected badges, short price lines. Dim tint at 14% alpha.

### Tertiary
- **Amber Caution** (#e9c98a): only for "this is not real data / be careful": the "Illustrative prices, not real market data" label, warn badges and warn callouts (12% alpha fill, 22% alpha ring).

### Neutral
- **Ground** (#070707): page. **Raise** (#0c0c0d): table wells and frame screen. **Panel** (#111112), **Panel 2** (#17171a), **Panel 3** (#1f1f23): successive raised surfaces; Panel 3 is the pressed/selected state.
- **Ink 2** (66% ink) body prose and secondary copy. **Ink 3** (50% ink) labels, table headers, captions.
- **Hairlines** at 7.5%, 12% and 20% white: `line` between rows, `line-2` for rings around controls, `line-3` for emphasis, dashed "pending" borders and link underlines.

### Named Rules
**The Never-Alone Rule.** Long and short colours never carry meaning alone. Every colour use is paired with a sign (+ or the true minus), a glyph (check, clock, x, flask) or a word.

**The Alpha-Step Rule.** Secondary text is the same off-white at lower alpha, not a new grey. Hairlines are white at low alpha, not hex greys.

**The Rare Amber Rule.** Amber appears only to flag illustration or caution. It is never decoration.

## Typography

**Display / Body Font:** Geist Variable (fallback ui-sans-serif, system-ui, sans-serif)
**Mono Font:** Geist Mono Variable (fallback ui-monospace, SFMono-Regular)

**Character:** Geist is neutral and engineered; headings sit at weight 500 with tight negative tracking so the page reads as a console, not a magazine. Mono is reserved for what is measured.

### Hierarchy
- **Display** (500, clamp(2.5rem, 1.6rem + 3.6vw, 3.75rem), 1.12, -0.03em): h1 on the home page only, capped near 15ch.
- **Headline** (500, 2.25rem, 1.12, -0.022em): h2 section titles.
- **Title** (500, 1.5rem, -0.015em): h3. Prose h2 uses this size.
- **Body** (400, 1rem / 1.6; prose 1.0625rem at ink-2): max line 68ch (`--measure`).
- **Label** (500, 0.6875 to 0.8125rem): badges, sidebar group heads, table headers, in ink-3, sentence case.
- **Data** (Geist Mono, tabular numerals, 0.9rem in tables): numbers, ids, chart axes (11px), `code`.

### Named Rules
**The Mono-For-Numbers Rule.** Mono is for numbers, ids, dates in data and code. Never for headings, buttons or running prose.

**The No-Eyebrow Rule.** No small uppercase kickers above headings; labels are sentence case.

## Layout

One centred column, `--wrap` 1180px with 2.5rem total side gutter (`min(100% - 2.5rem, 1180px)`). The home hero is a two-column grid (1.12fr / 0.88fr, 3rem gap); the "how it works" block is a 0.8fr / 1.2fr split with a sticky left head (top 110px) and about 9rem above it. Sections are varied, not repeated: hero, tilted terminal, stacked pipeline line, tables, step-through chart, spec strip. Do not build rows of identical cards.

Responsive: below 980px the fixed-rules spec strip goes to 2 columns with bottom rules; below 900px the terminal drops its sidebar and legend and rows collapse to two columns; at 720px scroll-padding grows (88px to 112px) for the stacked header. Wide tables sit in a horizontally scrolling `.table-scroll` well rather than reflowing. Spacing is rem-based and generous (0.35, 0.75, 1.25, 2, 4rem steps in use).

## Elevation & Depth

Depth is tonal plus hairline, with light, not shadow, as the lifted signal. Surfaces step up through Panel tones and are outlined with inset 1px rings (`box-shadow: 0 0 0 1px var(--line-2) inset`) instead of borders. The one heavy shadow belongs to the Frame bezel.

### Shadow Vocabulary
- **Inset ring** (`0 0 0 1px rgb(255 255 255 / 0.075 | 0.12 | 0.2) inset`): every chip, callout, tab strip, table well.
- **Frame lift** (`0 30px 80px -30px rgb(0 0 0 / 0.9), 0 0 60px -30px rgb(255 255 255 / 0.12)`): bezel only.
- **Primary rim** (inset white ring plus `-6px 0 18px -10px rgb(255 160 120 / 0.55)` and `6px 0 18px -10px rgb(140 170 255 / 0.55)`): the faint iridescent edge on the primary button.
- **Glow** (`drop-shadow(0 0 3px #fff) drop-shadow(0 0 16px rgb(255 255 255 / .5)) drop-shadow(0 0 44px rgb(255 255 255 / .22))`): hero candle sculpture front layer; pipeline and review nodes use a small white box-glow.

### Named Rules
**The Light-Not-Shadow Rule.** Emphasis is a white glow or a brighter ring, never a coloured shadow or a blurred grey drop.

## Shapes

Soft-square. Badges 6px, buttons 9px, wells/callouts/tables 10px (`--radius`), larger 16px (`--radius-lg`), Frame bezel 20px outside and 12px inside. Nodes in the pipeline and review trail are perfect circles. Keyboard focus is a 2px ink outline, 3px offset. Pending or not-built things use a dashed 20% white border or a faint 135-degree hatch, so "not there yet" is a shape, not just a dim colour.

## Components

### Buttons
- **Shape:** 9px radius, 44px tall, 0.9375rem weight 500, arrow icon nudges 3px right on hover.
- **Primary:** light vertical gradient (#f4f4f4 to #dcdcdc) with dark text (#0a0a0a) and the iridescent rim; hover lifts to #fff gradient.
- **Quiet:** Panel 2 with inset ring; hover Panel 3. Both press down 1px on `:active`.

### Badge and status chips
Compact 24px chip, 0.75rem, optional 13px icon. Tones: info (Panel 2), done (ink with 20% ring, check), pending (transparent, hatched, dashed look, clock), rejected (short on short-dim, x), warn (amber on amber-dim, flask). StatusChips renders F1 / F2 / F3 as done or pending with a screen-reader state word.

### Callout
Panel surface, 10px, ring only (no left stripe). Tones: note, honest (Panel 2, stronger ring, for in-sample / best of N statements), warn (amber tint and ring, flask icon, amber title). Max 68ch.

### Frame (bezel)
Outer 10px padded shell with 20px radius and a faint top-down white gradient, inner screen in Raise with 12px radius. Wraps every product-like thing: terminal, charts.

### Strategy index terminal (signature)
Grid of a 200px Panel sidebar (Show filter with counts, Market line) and a main area with a titlebar and one row per strategy: name and summary, F1/F2/F3 chips, verdict, arrow. Rows separated by hairlines, hover to Panel 2, arrow slides 3px. Planned rows are non-links with a Planned badge. Filters toggle `hidden` with `aria-pressed`.

### Pipeline stack line
The research path as a vertical line of circular glowing nodes joined by a 1px gradient rule; the unbuilt stage (Feature 3) has a hatched hollow node, a dashed connector and a "Not built yet" tag.

### Review trail
Same node-and-line vocabulary at smaller scale: Review or Replication badge, mono id, date, then the label.

### Tabs
Segmented strip in Panel with ring; selected tab Panel 3 with ring and top highlight; arrow, Home and End keys; panels server-rendered and toggled via `hidden`.

### Tables (ScenarioTable, F1/F2 results, `table.data`)
In a `.table-scroll` well (Raise, 1px line, 10px). 0.9rem, header row Panel with ink-3 labels, 1px row rules, numeric columns right aligned in tabular mono. Slippage scenarios are separate rows or columns labelled 0, 1, 2 ticks.

### Charts (CurveChart, AnnotatedChart, CandleSculpture)
TradingView Lightweight Charts on a transparent background inside a Frame. Axes mono 11px at 55% ink; grid 3.5% and 5% white; scale borders 8%; crosshair 25% white with Panel 3 labels. Candles are monochrome: up = hollow (#0c0c0d body, #f2f2f2 outline), down = grey (#8b8b91). Price lines use ink, dim, long (#8fd4c1) or short (#e7a39d) with labels; curves are ink 2px, dim and faint dashed, and long. Annotated chart steps through the idea with markers, a Step N of M count and dot nav. The hero sculpture is white line art with four fading echo layers and a caption saying it is illustrative.

### F3Pending and FixedRules
F3Pending is a dashed-border, hatched block with a clock tile and "Not built yet". FixedRules is a spec strip of definition terms (capital, size, cost, slippage) separated by vertical hairlines, ink values over ink-3 terms.

### Honesty labels
Part of the vocabulary: any chart with invented prices carries the amber flask label "Illustrative prices, not real market data"; every result carries in-sample, best of N where optimized, and its slippage scenario; owner rules that differ from TradingView are labelled as such.

### Motion
One authored motion: the strategy terminal on the home page starts at `rotateX(26deg) scale(0.92) translateY(30px)`, opacity .55, 1.5px blur, origin bottom centre, inside a 1800px perspective stage, and untilts linearly with scroll (`animation-timeline: view()`, range `entry 0% cover 42%`). It is wrapped in `@supports (animation-timeline: view())` and `@media (min-width: 900px) and (prefers-reduced-motion: no-preference)`. Use longhand animation properties, and keep `animation-timeline` and `animation-range` in a separate, doubled selector (`.tilt.tilt`), because minifiers fold the timeline into the shorthand and Chrome drops it. Everything else is a 0.2 to 0.3s state transition (ease-out `cubic-bezier(0.16, 1, 0.3, 1)`); reduced motion collapses all durations to 0.01ms.

## Do's and Don'ts

### Do:
- **Do** keep night mode only on #070707 with ink #f9f9f9 and alpha steps (66%, 50%) for secondary text.
- **Do** build edges from 1px alpha rules or inset rings (7.5%, 12%, 20% white).
- **Do** pair long (#8fd4c1) and short (#e7a39d) with a sign, glyph or word every time.
- **Do** use Geist Mono with tabular numerals for numbers, ids and chart text, and right-align numeric columns.
- **Do** put product views in a Frame bezel, and charts inside it.
- **Do** attach the amber "Illustrative prices, not real market data" label to any chart with invented prices.
- **Do** show honesty labels (in-sample, best of N, slippage scenario) as Badges or Callouts next to the numbers they qualify.
- **Do** show unbuilt work as dashed or hatched with "Not built yet".

### Don't:
- **Don't** add a light theme or any colour-scheme toggle.
- **Don't** use mono for headings, buttons or prose.
- **Don't** add eyebrows or kickers above headings.
- **Don't** use gradient text.
- **Don't** use coloured `border-left` accents on cards, callouts or lists.
- **Don't** make grids of identical cards; vary the form of each section.
- **Don't** let long or short colour be the only signal, or use pure red/green.
- **Don't** add a second authored motion or run the untilt below 900px or under reduced motion.
- **Don't** use amber for decoration, or real Databento prices in any visual.
