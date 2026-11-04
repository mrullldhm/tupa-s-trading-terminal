// Illustrative 1-minute candles for teaching Fair Price Reversal. Synthetic: no real market data.
// The story is checked below at build time, so a tweak that breaks the rules fails the build instead of teaching
// a wrong picture.

import type { Candle, Step, Story } from "./types.ts";
import { ownerSwings } from "./owner-swings.ts";

const TICK = 0.01;
const r = (p: number) => Number((Math.round(p / TICK) * TICK).toFixed(2));

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

// A fake January day: 08:40 New York is 13:40 UTC / 21:40 Malaysia.
const START = Date.UTC(2001, 0, 8, 13, 40) / 1000;
const m = (hh: number, mm: number) => (hh - 8) * 60 + mm - 40;

// Close path waypoints [minute index, close].
const PATH: [number, number][] = [
  [0, 72.47], [8, 72.52], [14, 72.44], [m(8, 58), 72.4],
  [m(8, 59), 72.56], // anchor close
  [m(9, 3), 72.43], [m(9, 9), 72.21], [m(9, 14), 72.12], [m(9, 19), 71.97], [m(9, 24), 71.9],
  [m(9, 28), 71.97], [m(9, 31), 71.99], [m(9, 34), 71.95], [m(9, 37), 71.94], [m(9, 40), 71.99],
  [m(9, 41), 72.08], // signal close above the swing high
  [m(9, 48), 72.15], [m(9, 55), 72.22], [m(10, 2), 72.3], [m(10, 8), 72.36], [m(10, 11), 72.41],
  [m(10, 20), 72.37], [m(10, 30), 72.43],
];
const N = m(10, 30) + 1;

function build(): Candle[] {
  const rand = rng(929);
  const closes: number[] = [];
  for (let i = 0; i < N; i++) {
    const k = PATH.findIndex(([x]) => x >= i);
    const [x1, y1] = PATH[k];
    const [x0, y0] = PATH[Math.max(0, k - 1)];
    const t = x1 === x0 ? 1 : (i - x0) / (x1 - x0);
    const exact = PATH.some(([x]) => x === i);
    closes.push(r(y0 + (y1 - y0) * t + (exact ? 0 : (rand() - 0.5) * 0.05)));
  }
  // Keep closes inside the story's bounds: above the excursion low, under the swing high until the signal, under the
  // target until the exit.
  for (let i = m(9, 0); i < N; i++) closes[i] = Math.max(closes[i], 71.89);
  for (let i = m(9, 32); i < m(9, 41); i++) closes[i] = Math.min(closes[i], 72.0);
  for (let i = m(9, 42); i < m(10, 11); i++) closes[i] = Math.min(closes[i], 72.35);
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const open = i === 0 ? 72.45 : closes[i - 1];
    const close = closes[i];
    const hi = Math.max(open, close) + r(rand() * 0.03);
    const lo = Math.min(open, close) - r(rand() * 0.03);
    out.push({ time: START + i * 60, open: r(open), high: r(hi), low: r(lo), close: r(close) });
  }
  // Pin the bars the story depends on.
  const pin = (i: number, c: Partial<Candle>) => (out[i] = { ...out[i], ...c });
  pin(m(8, 59), { open: 72.38, high: 72.59, low: 72.35, close: 72.56 }); // anchor: body 72.38 .. 72.56
  pin(m(9, 24), { low: 71.86 }); // excursion low
  pin(m(9, 31), { high: 72.03 }); // lower swing high (fixed owner rule)
  for (const d of [-3, -2, -1, 1, 2, 3]) {
    const i = m(9, 31) + d;
    pin(i, { high: Math.min(out[i].high, 72.01) });
  }
  // Establish the preceding alternating high, then keep the confirmed lower high
  // current until the break. Equal right highs do not create extra swing highs.
  pin(m(9, 29), { high: 72.10 });
  for (let i = m(9, 32); i < m(9, 41); i++) pin(i, { high: 72.02 });
  pin(m(9, 41), { open: 71.99, high: 72.1, low: 71.98, close: 72.08 }); // MSS long signal
  pin(m(9, 42), { open: 72.08, high: 72.12, low: 72.05, close: 72.1 }); // entry bar
  for (let i = m(9, 0); i <= m(10, 30); i++) {
    if (i !== m(9, 24)) pin(i, { low: Math.max(out[i].low, 71.88) });
  }
  // Target touch at 10:11 and nothing earlier above 72.37.
  for (let i = m(9, 42); i < m(10, 11); i++) pin(i, { high: Math.min(out[i].high, 72.37) });
  pin(m(10, 11), { high: 72.42 });
  // Keep candles internally consistent after pinning.
  return out.map((c) => ({
    ...c,
    high: r(Math.max(c.high, c.open, c.close)),
    low: r(Math.min(c.low, c.open, c.close)),
  }));
}

export const candles = build();

export const LEVELS = {
  bodyTop: 72.56,
  bodyBottom: 72.38,
  low: 71.86,
  swingHigh: 72.03,
  entry: 72.08,
  stop: 71.86,
  target: 72.38, // `near` target: the nearest body edge
};

export const IDX = {
  anchor: m(8, 59),
  open: m(9, 0),
  low: m(9, 24),
  swing: m(9, 31),
  swingConfirmed: m(9, 32),
  signal: m(9, 41),
  entry: m(9, 42),
  exit: m(10, 11),
};

export const steps: Step[] = [
  {
    title: "The anchor candle sets the fair price",
    text: "The last 1-minute candle before the session opens is the anchor. Its body, from open to close, is treated as the fair price zone. Wicks do not count.",
    until: IDX.anchor + 1,
    markers: [{ index: IDX.anchor, position: "aboveBar", shape: "arrowDown", text: "Anchor 21:59 MYT" }],
    lines: [
      { price: LEVELS.bodyTop, label: "Body top", tone: "ink" },
      { price: LEVELS.bodyBottom, label: "Body bottom", tone: "ink" },
    ],
  },
  {
    title: "Price moves far away from it",
    text: "After the open, price must travel beyond the body by at least a set multiple of ATR, a measure of normal candle size. Here it falls well below the body bottom.",
    until: IDX.low + 2,
    markers: [{ index: IDX.low, position: "belowBar", shape: "arrowUp", text: "Move down" }],
    lines: [
      { price: LEVELS.bodyTop, label: "Body top", tone: "dim" },
      { price: LEVELS.bodyBottom, label: "Body bottom", tone: "ink" },
    ],
  },
  {
    title: "A lower swing high forms",
    text: "The bounce stalls and makes a swing high: a candle whose high is at least the previous high and strictly above the next high. It confirms when the next candle closes. Swings alternate; a later same-type extreme can replace the newest swing.",
    until: IDX.swingConfirmed + 1,
    markers: [{ index: IDX.swing, position: "aboveBar", shape: "arrowDown", text: "Swing high" }],
    lines: [
      { price: LEVELS.bodyBottom, label: "Body bottom", tone: "dim" },
      { price: LEVELS.swingHigh, label: "Swing high", tone: "ink" },
    ],
  },
  {
    title: "A close above it is the signal",
    text: "When a candle closes above that swing high while price is still below the body, the market structure has shifted up. That close is the long signal.",
    until: IDX.signal + 1,
    markers: [{ index: IDX.signal, position: "belowBar", shape: "arrowUp", text: "Signal" }],
    lines: [
      { price: LEVELS.bodyBottom, label: "Body bottom", tone: "dim" },
      { price: LEVELS.swingHigh, label: "Swing high", tone: "ink" },
    ],
  },
  {
    title: "Place the entry limit, with stop and target",
    text: "The buy limit is placed at the signal close and starts working on the next candle. Here it fills at that candle's open at the same price. The stop goes at the lowest low of the move. This example uses the near target: the body bottom.",
    until: IDX.entry + 4,
    markers: [{ index: IDX.entry, position: "belowBar", shape: "arrowUp", text: "Buy" }],
    lines: [
      { price: LEVELS.target, label: "Target", tone: "long" },
      { price: LEVELS.entry, label: "Entry", tone: "ink" },
      { price: LEVELS.stop, label: "Stop", tone: "short" },
    ],
  },
  {
    title: "The target fills, the trade ends",
    text: "Price climbs back to the body and the limit target fills. If neither stop nor target had filled, the trade would close at the session's flat time.",
    until: candles.length,
    markers: [
      { index: IDX.entry, position: "belowBar", shape: "arrowUp", text: "Buy" },
      { index: IDX.exit, position: "aboveBar", shape: "arrowDown", text: "Target" },
    ],
    lines: [
      { price: LEVELS.target, label: "Target", tone: "long" },
      { price: LEVELS.stop, label: "Stop", tone: "short" },
    ],
  },
];

// Build-time checks that the picture obeys the rules it teaches.
function check() {
  const c = candles;
  const fail = (msg: string) => {
    throw new Error(`illustrative chart breaks its own story: ${msg}`);
  };
  const a = c[IDX.anchor];
  if (Math.min(a.open, a.close) !== LEVELS.bodyBottom || Math.max(a.open, a.close) !== LEVELS.bodyTop) fail("anchor body");
  const low = Math.min(...c.slice(IDX.open, IDX.signal + 1).map((x) => x.low));
  if (low !== LEVELS.low || c[IDX.low].low !== low) fail("excursion low");
  const s = c[IDX.swing].high;
  const state = ownerSwings(c)[IDX.swingConfirmed];
  if (state.highIndex !== IDX.swing || state.high !== s) fail("owner swing confirmation");
  if (state.prevHigh === null || s >= state.prevHigh) fail("owner lower high");
  for (let i = IDX.swing + 1; i < IDX.signal; i++) if (c[i].close > s) fail("early break");
  if (!(c[IDX.signal].close > s && c[IDX.signal].close < LEVELS.bodyBottom)) fail("signal close");
  if (c[IDX.entry].open !== LEVELS.entry) fail("entry at next open");
  for (let i = IDX.entry; i < IDX.exit; i++) {
    if (c[i].high >= LEVELS.target) fail("target touched early");
    if (c[i].low <= LEVELS.stop) fail("stop touched");
  }
  if (c[IDX.exit].high < LEVELS.target) fail("target not reached");
}
check();

export const story: Story = {
  label: "Step-by-step example of one Fair Price Reversal trade",
  symbol: "CL1! · 1m · example",
  summary: "Candlestick chart of an illustrative long setup: anchor candle, move down, swing high, signal, entry, target.",
  candles,
  steps,
};
