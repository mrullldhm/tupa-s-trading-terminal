// Illustrative 15-minute candles for teaching Supertrend + Kalman. Synthetic: no real market data.
// The indicators are computed over these candles with ports of tvtester/ta.py, and the story is checked below at
// build time, so a tweak that breaks the rules fails the build instead of teaching a wrong picture.
// Example settings: trigger "st", vol "none", exit "fixed", rr 2, swing 3, st_factor 3, ATR 10, kalman_q 0.01.

import { atr, bufferPivots, kalmanTrend, supertrend } from "./indicators.ts";
import type { Candle, Overlay, Step, Story } from "./types.ts";

const TICK = 0.01;
const r = (p: number) => Number((Math.round(p / TICK) * TICK).toFixed(2));

export const SETTINGS = { stFactor: 3, atrLen: 10, swing: 3, kalmanQ: 0.01, rr: 2 };

// Deterministic PRNG (mulberry32) so every build draws the same chart.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fake day; UTC clock = displayed New York clock. Bucket index b opens at 03:00 + 15 b minutes.
const START = Date.UTC(2001, 0, 9, 3, 0) / 1000;
const b = (hh: number, mm: number) => ((hh - 3) * 60 + mm) / 15;

// Close path waypoints [bucket, close]: a slide, a base with a lower low, then a turn up.
const PATH: [number, number][] = [
  [0, 73.2], [b(4, 0), 73.28], [b(5, 0), 73.05], [b(6, 0), 72.78], [b(7, 0), 72.5], [b(8, 0), 72.32],
  [b(8, 45), 72.22], [b(9, 15), 72.05], [b(9, 45), 71.96], [b(10, 15), 72.12], [b(10, 45), 72.05],
  [b(11, 15), 72.3], [b(11, 45), 72.5], [b(12, 30), 72.62], [b(13, 15), 72.85], [b(14, 0), 73.02],
  [b(14, 45), 72.96], [b(15, 45), 73.22], [b(16, 30), 73.4], [b(17, 0), 73.31],
];
const N = b(17, 0) + 1;

function build(): Candle[] {
  const rand = rng(1507);
  const closes: number[] = [];
  for (let i = 0; i < N; i++) {
    const k = PATH.findIndex(([x]) => x >= i);
    const [x1, y1] = PATH[k];
    const [x0, y0] = PATH[Math.max(0, k - 1)];
    const t = x1 === x0 ? 1 : (i - x0) / (x1 - x0);
    const exact = PATH.some(([x]) => x === i);
    closes.push(r(y0 + (y1 - y0) * t + (exact ? 0 : (rand() - 0.5) * 0.12)));
  }
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const open = i === 0 ? 73.18 : closes[i - 1];
    const close = closes[i];
    out.push({
      time: START + i * 900,
      open: r(open),
      high: r(Math.max(open, close) + rand() * 0.07),
      low: r(Math.min(open, close) - rand() * 0.07),
      close: r(close),
    });
  }
  return out;
}

export const candles = build();

const H = candles.map((c) => c.high);
const L = candles.map((c) => c.low);
const C = candles.map((c) => c.close);
const st = supertrend(H, L, C, SETTINGS.stFactor, SETTINGS.atrLen);
const atr10 = atr(H, L, C, SETTINGS.atrLen);
const kal = kalmanTrend(C, SETTINGS.kalmanQ);
const swingLow = bufferPivots(L, SETTINGS.swing, false);

// Last confirmed swing low at or before each bucket (the Python `_last_value`).
const lastSwingLow: number[] = [];
swingLow.forEach((v, i) => lastSwingLow.push(Number.isNaN(v) ? (i ? lastSwingLow[i - 1] : NaN) : v));

export const IDX = {
  swingLow: b(10, 0), // the pivot candle itself (confirmed 3 candles later)
  slopeUp: b(11, 15),
  flip: b(11, 30), // the completed candle that carries the signal
  decide: b(11, 45), // its first 1-minute bar decides; the fill is one minute later
  exit: b(16, 15),
};

export const LEVELS = {
  stop: 71.89, // last confirmed swing low at the signal candle
  decision: 72.37, // close of the 11:45 1-minute bar (inside the 11:45 candle)
  entry: 72.38, // next 1-minute open, 11:46
  target: 73.34, // entry + 2 x risk, risk = decision - stop = 48 ticks (Pine `profit=` counts from the fill)
};

const atrReady = (i: number) => !Number.isNaN(atr10[i]);
const curve = (keep: (i: number) => boolean, v: number[]) => v.map((x, i) => (keep(i) ? r(x) : null));

export const overlays: Overlay[] = [
  { key: "st-up", label: "Supertrend", tone: "long", values: curve((i) => atrReady(i) && st.dir[i] === -1, st.line) },
  { key: "st-down", label: "Supertrend", tone: "short", values: curve((i) => atrReady(i) && st.dir[i] === 1, st.line) },
  { key: "kalman", label: "Kalman", tone: "ink", values: curve(() => true, kal.level) },
];

const ST = ["st-up", "st-down"];
const ALL = [...ST, "kalman"];

export const steps: Step[] = [
  {
    title: "Read the trend on 15-minute candles",
    text: "The strategy builds 15-minute candles from the 1-minute data. Supertrend, a trend line built from ATR bands that only tighten toward price, sits above the candles while the trend is down. No long trade is allowed yet.",
    until: b(9, 45) + 1,
    markers: [],
    lines: [],
    overlays: ST,
  },
  {
    title: "The Kalman slope turns up",
    text: "A Kalman filter smooths the closes and estimates their slope. Here the slope turns positive. A long trade is only allowed while the slope points up.",
    until: IDX.slopeUp + 1,
    markers: [{ index: IDX.slopeUp, position: "belowBar", shape: "arrowUp", text: "Slope up" }],
    lines: [],
    overlays: ALL,
  },
  {
    title: "Supertrend flips up: the signal",
    text: "This candle closes above the Supertrend line, so Supertrend flips under price. The Kalman slope also points up, so the completed candle is a long signal.",
    until: IDX.flip + 1,
    markers: [{ index: IDX.flip, position: "aboveBar", shape: "arrowDown", text: "Flip up" }],
    lines: [],
    overlays: ALL,
  },
  {
    title: "Decide one minute later, with stop and target",
    text: "The test waits for the first 1-minute bar of the next candle to close, then the order fills at the next 1-minute open, at 11:46. The stop goes at the last confirmed swing low. The target is 96 ticks above the fill: twice the 48-tick distance from the decision close to the stop.",
    until: IDX.decide + 1,
    markers: [
      { index: IDX.swingLow, position: "belowBar", shape: "arrowUp", text: "Swing low" },
      { index: IDX.decide, position: "belowBar", shape: "arrowUp", text: "Buy" },
    ],
    lines: [
      { price: LEVELS.target, label: "Target 2R", tone: "long" },
      { price: LEVELS.entry, label: "Entry", tone: "ink" },
      { price: LEVELS.stop, label: "Stop", tone: "short" },
    ],
    overlays: ST,
  },
  {
    title: "The target fills, the trade ends",
    text: "Price keeps climbing and touches the target. This example uses one choice of each setting: Supertrend flip entry, no volatility filter, fixed stop and target. The test also tries other entries, filters and exits.",
    until: candles.length,
    markers: [
      { index: IDX.decide, position: "belowBar", shape: "arrowUp", text: "Buy" },
      { index: IDX.exit, position: "aboveBar", shape: "arrowDown", text: "Target" },
    ],
    lines: [
      { price: LEVELS.target, label: "Target 2R", tone: "long" },
      { price: LEVELS.stop, label: "Stop", tone: "short" },
    ],
    overlays: ST,
  },
];

// Build-time checks that the picture obeys the rules it teaches (strategies/supertrend_kalman.py).
function check() {
  const c = candles;
  const fail = (msg: string) => {
    throw new Error(`supertrend-kalman illustrative chart breaks its own story: ${msg}`);
  };
  const ticks = (p: number) => Math.round(p / TICK);
  // Timing: candles are whole, back-to-back 15-minute buckets, and the decision is in the bucket right after the
  // signal (its first 1-minute bar decides; the fill is that bar's next open).
  c.forEach((x, i) => {
    if (x.time % 900 !== 0) fail(`candle ${i} is off the 15-minute grid`);
    if (i && x.time - c[i - 1].time !== 900) fail(`gap before candle ${i}`);
  });
  if (IDX.decide !== IDX.flip + 1) fail("decision is not in the bucket after the signal");
  // Flat until the flip: no Supertrend flip either way before it (a flip down earlier would have been a short).
  for (let i = 1; i < IDX.flip; i++) if (st.dir[i] !== st.dir[i - 1]) fail(`early Supertrend flip at ${i}`);
  if (!(st.dir[IDX.flip - 1] === 1 && st.dir[IDX.flip] === -1)) fail("flip up");
  if (!(kal.slope[IDX.flip] > 0)) fail("Kalman slope at the signal");
  if (!(kal.slope[IDX.slopeUp - 1] <= 0 && kal.slope[IDX.slopeUp] > 0)) fail("slope turn");
  for (let i = IDX.slopeUp; i <= IDX.flip; i++) if (!(kal.slope[i] > 0)) fail("slope dips before the signal");
  for (let i = IDX.flip; i < c.length; i++) if (st.dir[i] !== -1) fail("Supertrend flips back down");
  // Stop: last confirmed swing low at the signal candle, below the decision close.
  if (ticks(lastSwingLow[IDX.flip]) !== ticks(LEVELS.stop)) fail("stop is not the last confirmed swing low");
  if (ticks(L[IDX.swingLow]) !== ticks(LEVELS.stop)) fail("swing low marker");
  const d = c[IDX.decide];
  for (const p of [LEVELS.decision, LEVELS.entry]) if (!(p >= d.low && p <= d.high)) fail("decision or fill outside its candle");
  if (ticks(d.open) > ticks(LEVELS.decision) + 5 || ticks(d.open) < ticks(LEVELS.decision) - 5) fail("decision far from the candle open");
  const risk = ticks(LEVELS.decision) - ticks(LEVELS.stop);
  if (risk <= 0) fail("stop not below the decision close");
  if (ticks(LEVELS.target) !== ticks(LEVELS.entry) + Math.round(SETTINGS.rr * risk)) fail("target is not 2R from the fill");
  for (let i = IDX.decide; i < IDX.exit; i++) {
    if (ticks(c[i].high) >= ticks(LEVELS.target)) fail("target touched early");
    if (ticks(c[i].low) <= ticks(LEVELS.stop)) fail("stop touched");
  }
  if (ticks(c[IDX.exit].high) < ticks(LEVELS.target) || ticks(c[IDX.exit].low) <= ticks(LEVELS.stop)) fail("exit candle");
}
check();

export const story: Story = {
  label: "Step-by-step example of one Supertrend + Kalman trade",
  symbol: "CL1! · 15m · example",
  summary: "Candlestick chart of an illustrative long setup on 15-minute candles: Supertrend above price, Kalman slope turns up, Supertrend flips up, entry with swing-low stop and 2R target, target fills.",
  candles,
  steps,
  overlays,
};
