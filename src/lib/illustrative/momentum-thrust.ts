// Illustrative 15-minute candles for teaching Momentum Thrust. Synthetic: no real market data.
// The thrust is found by a port of strategies/momentum_thrust.py `detect` (LuxAlgo defaults) run over these
// candles, and the story is checked below at build time, so a tweak that breaks the rules fails the build.
// Example settings: entry "market", stop "ignition", stop_kind "close", rr 0 (no target), hold 5, exit "none".

import { atr, tr } from "./indicators.ts";
import type { Candle, Step, Story } from "./types.ts";

const TICK = 0.01;
const r = (p: number) => Number((Math.round(p / TICK) * TICK).toFixed(2));
const ticks = (p: number) => Math.round(p / TICK);

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

// A fake day; UTC clock = displayed New York clock. Candle i opens at 00:30 + 15 i minutes.
const START = Date.UTC(2001, 0, 9, 0, 30) / 1000;
const CHOP = 60; // candles 0 .. 59: an ordinary, directionless market (warms up ATR(50) and RSI(14))
const BASE0 = CHOP; // candles 60 .. 69: the quiet base
const IGN0 = BASE0 + 10; // candles 70, 71: the ignition
const N = IGN0 + 2 + 7;

function build(): { candles: Candle[]; volume: number[] } {
  const rand = rng(4242);
  const candles: Candle[] = [];
  const volume: number[] = [];
  let close = 74.0;
  for (let i = 0; i < N; i++) {
    const open = close;
    let move: number;
    let wick: number;
    let vol: number;
    if (i < CHOP) {
      move = (rand() - 0.5) * 0.24 - (close - 74.0) * 0.25; // mean-reverting chop around 74.00
      wick = 0.03 + rand() * 0.06;
      vol = 900 + rand() * 300;
    } else if (i < IGN0) {
      move = (rand() - 0.5) * 0.04 - (close - 73.98) * 0.5; // quiet, tight
      wick = 0.01 + rand() * 0.015;
      vol = 500 + rand() * 150;
    } else if (i < IGN0 + 2) {
      move = i === IGN0 ? 0.26 : 0.24; // two strong up candles
      wick = 0.01;
      vol = i === IGN0 ? 2900 : 2400;
    } else {
      move = 0.03 + (rand() - 0.4) * 0.1; // follow-through drift
      wick = 0.03 + rand() * 0.04;
      vol = 1200 + rand() * 300;
    }
    close = r(open + move);
    const hi = r(Math.max(open, close) + (i >= IGN0 && i < IGN0 + 2 ? 0.01 : wick));
    const lo = r(Math.min(open, close) - (i >= IGN0 && i < IGN0 + 2 ? 0.02 : wick));
    candles.push({ time: START + i * 900, open: r(open), high: hi, low: lo, close });
    volume.push(Math.round(vol));
  }
  return { candles, volume };
}

const built = build();
export const candles = built.candles;
export const V = built.volume;
const H = candles.map((c) => c.high);
const L = candles.map((c) => c.low);
const C = candles.map((c) => c.close);

// --- port of momentum_thrust.detect (default inputs) ----------------------------------------------------
function rmaFrom(x: number[], n: number, start: number): number[] {
  const out = x.map(() => NaN);
  if (x.length - start < n) return out;
  let v = x.slice(start, start + n).reduce((a, b) => a + b, 0) / n;
  out[start + n - 1] = v;
  for (let i = start + n; i < x.length; i++) {
    v = (x[i] + (n - 1) * v) / n;
    out[i] = v;
  }
  return out;
}
const win = (x: number[], i: number, n: number) => (i < n - 1 ? null : x.slice(i - n + 1, i + 1));
const highest = (x: number[], i: number, n: number) => { const w = win(x, i, n); return w ? Math.max(...w) : NaN; };
const lowest = (x: number[], i: number, n: number) => { const w = win(x, i, n); return w ? Math.min(...w) : NaN; };
const sma = (x: number[], i: number, n: number) => { const w = win(x, i, n); return w ? w.reduce((a, b) => a + b, 0) / n : NaN; };

const TR = tr(H, L, C);
const A = atr(H, L, C, 50);
const gain = C.map((c, i) => (i ? Math.max(c - C[i - 1], 0) : 0));
const loss = C.map((c, i) => (i ? Math.max(C[i - 1] - c, 0) : 0));
const up = rmaFrom(gain, 14, 1);
const dn = rmaFrom(loss, 14, 1);
export const RSI = C.map((_, i) =>
  Number.isNaN(up[i]) || Number.isNaN(dn[i]) ? NaN : dn[i] === 0 ? 100 : up[i] === 0 ? 0 : 100 - 100 / (1 + up[i] / dn[i]));

type Thrust = { t: number; d: 1 | -1; k: number; late: boolean; ignLo: number; ignHi: number; baseHi: number; baseLo: number };
function detect(): Thrust[] {
  const out: Thrust[] = [];
  let last: number | null = null;
  let upRun = 0;
  let dnRun = 0;
  for (let t = 0; t < C.length; t++) {
    upRun = t > 0 && C[t] > C[t - 1] ? upRun + 1 : 0;
    dnRun = t > 0 && C[t] < C[t - 1] ? dnRun + 1 : 0;
    if (!(t > 63 && (last === null || t - last > 5))) continue;
    for (let k = 1; k <= 3; k++) {
      const a = A[t - k], hi = highest(H, t - k, 10), lo = lowest(L, t - k, 10);
      if (Number.isNaN(a) || a <= 0 || Number.isNaN(hi) || Number.isNaN(lo)) continue;
      if (!(hi - lo <= 4 * a && sma(TR, t - k, 10) <= 0.9 * a)) continue;
      const move = C[t] - C[t - k];
      let widest = 0, heavy = 0, iLo = L[t], iHi = H[t];
      for (let j = 0; j < k; j++) {
        widest = Math.max(widest, TR[t - j]);
        heavy = Math.max(heavy, V[t - j]);
        iLo = Math.min(iLo, L[t - j]);
        iHi = Math.max(iHi, H[t - j]);
      }
      const av = sma(V, t - k, 20);
      const volOk = Number.isNaN(av) || av <= 0 || heavy >= 1.5 * av;
      const sizeOk = Math.abs(move) >= 2 * a && widest >= 1.5 * a;
      const span = H[t] - L[t];
      const locUp = span > 0 ? ((C[t] - L[t]) / span) * 100 : 50;
      const locDn = span > 0 ? ((H[t] - C[t]) / span) * 100 : 50;
      const r0 = RSI[t - k];
      const upOk = move > 0 && sizeOk && volOk && upRun >= k && C[t] > hi && locUp >= 75 && r0 <= 60 && RSI[t] >= 65;
      const dnOk = move < 0 && sizeOk && volOk && dnRun >= k && C[t] < lo && locDn >= 75 && r0 >= 40 && RSI[t] <= 35;
      if (upOk || dnOk) {
        const run = upOk ? (hi - lowest(L, t - k, 60)) / a : (highest(H, t - k, 60) - lo) / a;
        out.push({ t, d: upOk ? 1 : -1, k, late: !Number.isNaN(run) && run >= 8, ignLo: iLo, ignHi: iHi, baseHi: hi, baseLo: lo });
        last = t;
        break;
      }
    }
  }
  return out;
}
const found = detect();
const thrust = found[0];

export const IDX = {
  base0: BASE0,
  ignition: IGN0,
  thrust: IGN0 + 1, // the completed candle that carries the signal
  decide: IGN0 + 2, // its first 1-minute bar decides; the fill is one minute later
  exit: IGN0 + 2 + 5, // hold 5: the fill candle counts as the first, exit decided on the candle after the fifth
};

export const LEVELS = {
  baseTop: thrust?.baseHi ?? NaN,
  baseBottom: thrust?.baseLo ?? NaN,
  entry: candles[IDX.decide].open, // about the decision bar's open; the fill is the next 1-minute open
  stop: thrust?.ignLo ?? NaN, // ignition low: a close below it ends the trade (stop kind "close")
};

export const steps: Step[] = [
  {
    title: "An ordinary market",
    text: "Fifteen-minute candles built from the 1-minute data. Price wanders with no direction. The indicator measures everything in units of a normal candle: the 50-candle average true range (ATR).",
    until: CHOP,
    markers: [],
    lines: [],
  },
  {
    title: "A quiet base forms",
    text: "Ten candles in a row stay inside a narrow range: at most 4 ATR from top to bottom, and the candles themselves are smaller than normal (average true range at most 0.9 ATR). This is the calm a thrust has to erupt from.",
    until: IGN0,
    markers: [{ index: BASE0, position: "aboveBar", shape: "circle", text: "Base" }],
    lines: [
      { price: LEVELS.baseTop, label: "Base top", tone: "dim" },
      { price: LEVELS.baseBottom, label: "Base bottom", tone: "dim" },
    ],
  },
  {
    title: "Ignition: the thrust",
    text: "Two strong candles close higher in a row, travel more than 2 ATR, close above the base and near their highs, on more than 1.5x the usual volume, while RSI swings from below 60 to above 65. Price had not already run far before the base, so this is an initiation thrust, not a late one.",
    until: IDX.thrust + 1,
    markers: [{ index: IDX.thrust, position: "belowBar", shape: "arrowUp", text: "Thrust" }],
    lines: [{ price: LEVELS.baseTop, label: "Base top", tone: "dim" }],
  },
  {
    title: "Enter one minute later",
    text: "The test waits for the first 1-minute bar of the next candle to close, then buys at the next 1-minute open. In this example the invalidation level is the low of the ignition candles: a 15-minute close below it ends the trade, as in the indicator's own plan.",
    until: IDX.decide + 1,
    markers: [{ index: IDX.decide, position: "belowBar", shape: "arrowUp", text: "Buy" }],
    lines: [
      { price: LEVELS.entry, label: "Entry", tone: "ink" },
      { price: LEVELS.stop, label: "Invalidation", tone: "short" },
    ],
  },
  {
    title: "The holding clock ends the trade",
    text: "Momentum bursts are short. After five completed candles the trade closes at market. The test also tries stop and limit entries, other stops, targets of 1 to 3R, other holding clocks, breakeven and trailing stops.",
    until: candles.length,
    markers: [
      { index: IDX.decide, position: "belowBar", shape: "arrowUp", text: "Buy" },
      { index: IDX.exit, position: "aboveBar", shape: "arrowDown", text: "Hold 5" },
    ],
    lines: [{ price: LEVELS.stop, label: "Invalidation", tone: "short" }],
  },
];

// Build-time checks that the picture obeys the rules it teaches (strategies/momentum_thrust.py).
function check() {
  const fail = (msg: string) => {
    throw new Error(`momentum-thrust illustrative chart breaks its own story: ${msg}`);
  };
  candles.forEach((x, i) => {
    if (x.time % 900 !== 0) fail(`candle ${i} is off the 15-minute grid`);
    if (!(x.low <= Math.min(x.open, x.close) && x.high >= Math.max(x.open, x.close))) fail(`candle ${i} OHLC`);
  });
  if (found.length !== 1) fail(`expected exactly one thrust, found ${found.length}`);
  if (!(thrust.t === IDX.thrust && thrust.d === 1 && thrust.k === 2 && !thrust.late)) fail("thrust shape / timing");
  if (!(thrust.baseHi === highest(H, IGN0 - 1, 10) && thrust.baseLo === lowest(L, IGN0 - 1, 10))) fail("base levels");
  if (ticks(LEVELS.stop) >= ticks(LEVELS.entry)) fail("stop not below the entry");
  for (let i = IDX.decide; i < IDX.exit; i++) if (ticks(C[i]) < ticks(LEVELS.stop)) fail("closed through the invalidation level");
  if (!(C[IDX.exit - 1] > LEVELS.entry)) fail("example trade should end above its entry");
}
check();

export const story: Story = {
  label: "Step-by-step example of one Momentum Thrust trade",
  symbol: "CL1! · 15m · example",
  summary: "Candlestick chart of an illustrative long: an ordinary market, a quiet ten-candle base, a two-candle upside thrust on heavy volume, entry one minute after the thrust candle, invalidation at the ignition low, exit after five candles.",
  candles,
  steps,
};
