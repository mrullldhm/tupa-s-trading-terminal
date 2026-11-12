---
name: Tupa's Trading Terminal
description: A night-mode research dashboard that answers one question first, can a CL strategy pass the Topstep 50K Combine.
colors:
  ink-blue-ground: "#0d0e12"
  sunk-sidebar: "#090a0d"
  panel-veil: "rgb(255 255 255 / 0.035)"
  panel-veil-raised: "rgb(255 255 255 / 0.06)"
  hairline: "rgb(255 255 255 / 0.09)"
  hairline-strong: "rgb(255 255 255 / 0.16)"
  ink: "#f6f7f9"
  ink-secondary: "rgb(236 239 245 / 0.7)"
  ink-tertiary: "rgb(236 239 245 / 0.56)"
  sky: "#5b8cff"
  sky-ink: "#9db8ff"
  sky-glow: "rgb(70 110 255 / 0.22)"
  pass-green: "#34c38f"
  fail-red: "#f0616d"
  unconfirmed-amber: "#e3a63b"
  pale-button: "#e6e7ea"
  button-ink: "#121317"
  series-blue: "#3987e5"
  series-rust: "#d95926"
  series-jade: "#199e70"
  series-ochre: "#c98500"
  series-rose: "#d55181"
  series-lavender: "#9085e9"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.86em"
    fontWeight: 400
rounded:
  sm: "7px"
  md: "10px"
  lg: "14px"
  pill: "99px"
spacing:
  gutter: "clamp(1rem, 3vw, 2rem)"
  panel-x: "1.25rem"
  panel-y: "1.1rem"
  stack: "1rem"
  cell-x: "0.75rem"
  sidebar: "248px"
  content-max: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.pale-button}"
    textColor: "{colors.button-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.4rem"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.button-ink}"
  button-ghost:
    backgroundColor: "rgb(255 255 255 / 0.045)"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.4rem"
  button-ghost-hover:
    backgroundColor: "rgb(255 255 255 / 0.09)"
  chip-status:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 0.55rem"
    height: "1.5rem"
  chip-fail:
    backgroundColor: "rgb(240 97 109 / 0.08)"
    textColor: "{colors.fail-red}"
  chip-pass:
    backgroundColor: "rgb(52 195 143 / 0.08)"
    textColor: "{colors.pass-green}"
  chip-unconfirmed:
    backgroundColor: "rgb(227 166 59 / 0.08)"
    textColor: "{colors.unconfirmed-amber}"
  filter-pill:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "2rem"
  filter-pill-pressed:
    backgroundColor: "{colors.pale-button}"
    textColor: "{colors.button-ink}"
  panel:
    backgroundColor: "{colors.panel-veil}"
    rounded: "{rounded.lg}"
    padding: "1.1rem 1.25rem 1.25rem"
  nav-item:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 0.7rem"
    height: "2.25rem"
  nav-item-active:
    backgroundColor: "rgb(255 255 255 / 0.08)"
    textColor: "{colors.ink}"
---

# Design System: Tupa's Trading Terminal

## Overview

**Creative North Star: "The Night Desk Ledger"**

A research terminal read at night: a near-black ink-blue ground, a darker sunk sidebar, and thin veiled panels that hold numbers rather than decoration. The only atmosphere is a cool blue sky glow that rises behind each page head and fades before the first panel. Everything below the head is quiet, dense and tabular, so the answer and the evidence carry the page.

The visual language follows a modern trading-app dashboard (look only): bold tight Geist headings, a pale gray primary button with dark ink, pill chips for status, white-alpha panels with hairline borders. Colour is rationed by meaning. Green and red speak only about pass/fail checks and year bars; amber marks values that are not confirmed; the six categorical series colours identify strategies. Money is printed in neutral ink with a sign, never tinted.

The voice is plain and honest. Labels say what a thing is in simple English, status is always icon plus word, and the system has no marketing surfaces: no hero imagery, no signal-seller glow on numbers.

**Key Characteristics:**
- Night-mode only (`color-scheme: dark`); one ground, one sunk sidebar, one panel material.
- Sky glow (radial gradient) behind page heads, nowhere else.
- Panels are the single container: 1px hairline, 14px radius, never nested.
- Tabular numerals on every figure; Geist Mono for code and identifiers.
- Status = icon + word in a pill; colour is never the only signal.
- Fixed categorical colour per strategy, reused in nav, tables, charts and legends.

## Colors

A cold, low-chroma dark palette where hue is spent only on meaning: sky for focus and the answer, green/red for checks, amber for unconfirmed, six series colours for strategies.

### Primary
- **Sky** (sky): focus rings, the current step in a progress track, exit-share bars, the active sort arrow's ink. The system's one interactive accent.
- **Sky Ink** (sky-ink): the lighter sky used as text: the "Not yet." answer in the home H1, "read more" links, disclosure summaries, sort indicators.
- **Sky Glow** (sky-glow): the radial gradient behind page heads (`radial-gradient(34rem 16rem at 25% 0%, sky-glow, transparent 70%)`; home uses a wider 40rem x 20rem version).

### Secondary
- **Pass Green** (pass-green) and **Fail Red** (fail-red): pass/fail check icons and values, pass/fail chips, and up/down year bars. Nothing else.
- **Unconfirmed Amber** (unconfirmed-amber): the "Testing" chip, the live status dot, and warning lines for Topstep values not yet confirmed.

### Tertiary
- **Strategy series** (series-blue, series-rust, series-jade, series-ochre, series-rose, series-lavender): a fixed categorical set validated on the dark ground. Each strategy owns one colour for its nav swatch, table name bar, equity line and legend dash. Assignment is fixed per strategy, never by sort order.

### Neutral
- **Ink-Blue Ground** (ink-blue-ground): page background and `theme-color`.
- **Sunk Sidebar** (sunk-sidebar): the left rail, one step darker than the ground.
- **Panel Veil / Raised** (panel-veil, panel-veil-raised): white-alpha panel fills; raised for hover and selected surfaces.
- **Hairline / Strong** (hairline, hairline-strong): 1px panel and row borders; strong for buttons, chips and popovers.
- **Ink / Secondary / Tertiary** (ink, ink-secondary, ink-tertiary): headings and figures; body and prose; table headers, captions and meta.
- **Pale Button / Button Ink** (pale-button, button-ink): primary button and pressed filter pill.

### Named Rules
**The Meaning-Only Colour Rule.** Green and red appear only for pass/fail checks and year bars. Profit and loss figures are printed in ink with a + or - sign.

**The Fixed Series Rule.** A strategy's colour is its identity everywhere it appears. Never reassign colours by rank, filter or position.

**The Amber Means Unconfirmed Rule.** Amber marks unconfirmed or in-progress values only; it never decorates.

## Typography

**Display Font:** Geist Variable (with ui-sans-serif, system-ui)
**Body Font:** Geist Variable
**Label/Mono Font:** Geist Mono Variable (with ui-monospace) for code, identifiers and `.mono` text

**Character:** One geometric grotesk at two temperatures: bold and tightly tracked for headings, regular and open for reading. Stylistic sets ss01 and cv11 are on globally.

### Hierarchy
- **Display** (700, fluid 2rem to 3.25rem, 1.12, -0.035em): the page H1 only, balanced wrap, about 19ch wide on home.
- **Headline** (700, 1.25rem, -0.025em): panel and section titles (H2). The home "Closest attempt" panel uses 1.35rem.
- **Title** (700, 1rem, -0.01em): H3 sub-heads inside panels.
- **Body** (400, 15px, 1.55): running text; prose capped at 68ch, leads at 56-60ch and 1.05rem in ink-secondary.
- **Label** (500, 0.75rem): table headers, chips, meta terms, axis ticks (0.7rem). Sentence case, no uppercase, no added tracking.

### Named Rules
**The Tabular Figures Rule.** Every number that can sit beside another number uses `font-variant-numeric: tabular-nums`.

**The Sentence Case Rule.** Labels and headers are sentence case at normal tracking. Hierarchy comes from weight and ink level, not capitals.

## Layout

An app shell: a 248px sticky sunk sidebar (full viewport height) beside a main column. The main column carries a 3.5rem sticky top bar (ground at 82% opacity with a 12px backdrop blur) holding breadcrumbs and a live status pill, then content capped at 1240px with a fluid gutter (`clamp(1rem, 3vw, 2rem)`).

Each page opens with a head block (2-3.25rem top padding, sky glow behind it) followed by a vertical stack of panels separated by 1rem. Two-up splits use equal columns with a 1rem gap. The home head is a two-column grid (1.35fr / 1fr): question and actions left, a summary panel right.

Responsive: below 1100px the home head stacks; below 960px the sidebar hides, the brand moves into the top bar and navigation becomes a dropdown panel; below 860px splits stack and the first table column becomes sticky while numbers scroll sideways; below 720px wide tables swap for stacked row cards.

## Elevation & Depth

Depth is tonal, not shadowed. The sidebar sinks below the ground; panels lift by a faint white veil and a hairline. Shadows exist only on things that float above content: popovers and tooltips. Small halo rings (3-4px spread at 18-20% alpha) mark live or current dots.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 16px 40px rgb(0 0 0 / 0.5)`): the mobile nav dropdown.
- **Tooltip** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.45)`): the chart crosshair readout.
- **Halo** (`box-shadow: 0 0 0 4px rgb(91 140 255 / 0.2)`): the current step dot; amber variant at 3px for the live dot.

### Named Rules
**The Flat Panel Rule.** Panels never cast shadows. If something needs a shadow, it must be floating over other content.

## Shapes

Three radii plus a pill. Buttons and nav items use the tight 7px; tooltips and inner grids 10px; panels and popovers 14px; chips, filter pills, legend buttons and scrollbars are fully round (99px). Small data marks keep 2-3px corners (series swatches, bars). Borders are always 1px; there are no thick strokes or offset shapes.

## Components

### Buttons
- **Shape:** gently squared (7px), 2.4rem tall, 0 1rem padding, 14px/500 label, optional 16px arrow icon after the word.
- **Primary:** pale gray fill with dark ink; hover goes to pure white. One per view, for the main next step.
- **Ghost:** 4.5% white veil with a strong hairline; hover deepens the veil to 9% and the border to 24%.
- **Focus:** 2px sky outline, 2px offset. Transitions 0.2s on the shared ease (`cubic-bezier(0.16, 1, 0.3, 1)`).

### Chips
- **Status chip:** 1.5rem pill, strong hairline, 12px stroke icon plus word ("Dropped", "Testing", "Candidate"). Tinted variants use their meaning colour for text, 35% alpha border, 8% alpha fill.
- **Filter pill:** 2rem pill, transparent with strong hairline; pressed state switches to the pale button fill with dark ink. Optional series swatch and a dimmed count.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** panel veil; the strategy verdict panel alone may carry a faint sky wash and sky-tinted border.
- **Shadow Strategy:** none (see Flat Panel Rule).
- **Border:** 1px hairline.
- **Internal Padding:** 1.1rem x 1.25rem; panel heads sit on a baseline row with a tertiary note on the right.

### Navigation
- **Sidebar items:** 2.25rem rows, 7px radius, 16px stroke icon plus label at 0.875rem/500 in ink-secondary. Hover adds a 5% veil; current page an 8% veil and full ink.
- **Strategy sub-list:** indented under a 1px hairline rule, 0.8rem/400 labels each with a 7px series swatch.
- **Mobile:** a ghost menu button opens a 14px-radius popover containing the same list.

### Data tables
- 0.875rem body, 0.75rem/500 tertiary headers, 1px hairline row rules, 2.5% veil on row hover. Numeric columns right-aligned and tabular. Strategy name cells lead with a 4px-wide series bar. Sortable headers are bare buttons with a sky-ink direction arrow.
- **Pass checks:** one cell per check, stroke check or cross icon plus value. Passing values are green; failing values stay in ink with a red cross.

### Equity chart (signature)
- 2px series lines over 6% white grid lines and a dashed zero line. Legend items are pill buttons; pressing one dims every other line to 22% opacity, thickens the chosen line to 2.6px and shows its end label. A 1px crosshair follows the pointer with a floating 10px-radius readout.

### Year bars
- Small column chart, 3px gaps, green bars up and red bars down (85% opacity) from a 28% white baseline, 3px outer corners, tabular year labels.

### Icons
- One stroke set on a 16px grid, 1.5 stroke, round caps and joins, `currentColor`. Inline SVG only.

## Do's and Don'ts

### Do:
- **Do** put new content in a panel (panel veil, 1px hairline, 14px radius) and stack panels with a 1rem gap.
- **Do** open every page with a head block and the sky glow behind it, then go quiet.
- **Do** show status as a pill chip with a stroke icon and a word.
- **Do** use the strategy's fixed series colour wherever that strategy appears.
- **Do** print money in ink with a sign, and every figure in tabular numerals.
- **Do** mark unconfirmed values with amber and an icon, in plain words.

### Don't:
- **Don't** use green or red for profit and loss figures; they are reserved for pass/fail checks and year bars.
- **Don't** nest panels or give panels shadows.
- **Don't** signal state by colour alone.
- **Don't** add a light theme surface or bright fills beyond the pale primary button and pressed pill.
- **Don't** use uppercase tracked labels; labels are sentence case.
