// Synthetic teaching candles only. These do not reproduce a real trading day.
import type { Candle, Step, Story } from "./types";

const START = Date.UTC(2001, 0, 8, 9, 0) / 1000;
const price = (ticks: number) => Number((72 + ticks / 100).toFixed(2));

// OHLC in ticks above 72.00. Authored to show a higher low, a new swing high,
// a trigger without a fill, a later retracement fill, and then the target.
const bars: [number, number, number, number][] = [
  [45, 50, 43, 48], [48, 58, 46, 56], [56, 65, 54, 62],
  [62, 63, 48, 50], [50, 52, 38, 40], [40, 42, 30, 33],
  [33, 45, 32, 43], [43, 57, 41, 55], [55, 68, 53, 66],
  [66, 75, 64, 72], [72, 73, 62, 64], [64, 66, 55, 57],
  [57, 59, 52, 54], [54, 57, 50, 53], [53, 61, 52, 59],
  [59, 68, 57, 66], [66, 73, 64, 71], [71, 76, 69, 73],
  [73, 74, 63, 65], [65, 67, 52, 54], [50, 50, 47, 48],
  [48, 55, 46, 53], [53, 54, 43, 45], [45, 47, 33, 35],
  [35, 37, 24, 27], [27, 34, 25, 32], [32, 37, 30, 35],
];

export const candles: Candle[] = bars.map(([open, high, low, close], i) => ({
  time: START + i * 60,
  open: price(open), high: price(high), low: price(low), close: price(close),
}));

const IDX = { low: 5, high: 9, hl: 13, stop: 17, trigger: 20, fill: 21, exit: 24 };
const LEVELS = { break: 72.50, stop: 72.76, entry: 72.51, target: 72.26 };

export const steps: Step[] = [
  {
    title: "Read the higher timeframes first",
    text: "Assume the 1-hour chart has a candidate swing low, while 15 minutes and 5 minutes are already in downtrends. That gives a short bias. The chart shown here is only the 1-minute entry view; the higher timeframes are not drawn.",
    until: IDX.high + 2,
    markers: [
      { index: IDX.low, position: "belowBar", shape: "arrowUp", text: "Swing low" },
      { index: IDX.high, position: "aboveBar", shape: "arrowDown", text: "Swing high" },
    ],
    lines: [],
  },
  {
    title: "A higher low is still a candidate",
    text: "The next low is 72.50, above the previous low at 72.30: a higher low (HL). The following candle confirms the turn. It stays a candidate until the next swing high forms, so there is no entry yet.",
    until: IDX.hl + 2,
    markers: [
      { index: IDX.low, position: "belowBar", shape: "arrowUp", text: "Previous low" },
      { index: IDX.hl, position: "belowBar", shape: "arrowUp", text: "Candidate HL" },
    ],
    lines: [{ price: LEVELS.break, label: "Higher low", tone: "ink" }],
  },
  {
    title: "The next swing high fixes the stop",
    text: "A swing high forms at 72.76 and is confirmed one candle later. The higher low is now real. A touch of 72.50 will trigger the short. The stop is 26 ticks above it, so the sell limit moves up 1 tick to 72.51 to cap risk at 25 ticks.",
    until: IDX.stop + 2,
    markers: [
      { index: IDX.hl, position: "belowBar", shape: "arrowUp", text: "Real HL" },
      { index: IDX.stop, position: "aboveBar", shape: "arrowDown", text: "Swing high / stop" },
    ],
    lines: [
      { price: LEVELS.stop, label: "Stop", tone: "short" },
      { price: LEVELS.entry, label: "Sell limit", tone: "ink" },
    ],
  },
  {
    title: "Touching the higher low triggers the order",
    text: "Price opens at the 72.50 break point, shifting 1-minute structure down. The stop-limit order is now an active sell limit at 72.51. This candle never reaches that price, so the trade has not filled yet.",
    until: IDX.trigger + 1,
    markers: [{ index: IDX.trigger, position: "belowBar", shape: "arrowUp", text: "Trigger / no fill" }],
    lines: [
      { price: LEVELS.stop, label: "Stop", tone: "short" },
      { price: LEVELS.entry, label: "Sell limit", tone: "ink" },
    ],
  },
  {
    title: "The retracement fills the short",
    text: "The next candle comes back to 72.51 and the sell limit fills. The stop stays at 72.76 and the target is 25 ticks below the fill, at 72.26. If a new 1-minute swing high had formed before the fill, the unfilled order would be cancelled.",
    until: IDX.fill + 1,
    markers: [{ index: IDX.fill, position: "aboveBar", shape: "arrowDown", text: "Sell 72.51" }],
    lines: [
      { price: LEVELS.stop, label: "Stop", tone: "short" },
      { price: LEVELS.entry, label: "Entry", tone: "ink" },
      { price: LEVELS.target, label: "Target", tone: "long" },
    ],
  },
  {
    title: "The target closes this example trade",
    text: "Price reaches 72.26 before the stop: a 25-tick gain before costs in this made-up example. A trade can also end at the stop or the 14:30 New York session close. One winning illustration says nothing about the strategy's overall results below.",
    until: candles.length,
    markers: [
      { index: IDX.fill, position: "aboveBar", shape: "arrowDown", text: "Sell" },
      { index: IDX.exit, position: "belowBar", shape: "arrowUp", text: "Target" },
    ],
    lines: [
      { price: LEVELS.stop, label: "Stop", tone: "short" },
      { price: LEVELS.entry, label: "Entry", tone: "ink" },
      { price: LEVELS.target, label: "Target", tone: "long" },
    ],
  },
];

// Fail the build if the picture stops obeying the rules it explains.
function check() {
  const assert = (ok: boolean, message: string) => {
    if (!ok) throw new Error(`Tupa Trade illustrative chart: ${message}`);
  };
  for (const c of candles) {
    assert(c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close), "invalid candle");
  }
  for (const i of [IDX.low, IDX.hl]) {
    assert(candles[i - 1].low >= candles[i].low && candles[i + 1].low > candles[i].low, "invalid swing low");
  }
  for (const i of [IDX.high, IDX.stop]) {
    assert(candles[i - 1].high <= candles[i].high && candles[i + 1].high < candles[i].high, "invalid swing high");
  }
  assert(candles[IDX.hl].low > candles[IDX.low].low, "not a higher low");
  assert(candles[IDX.hl].low === LEVELS.break && candles[IDX.stop].high === LEVELS.stop, "incorrect structure levels");
  assert(Math.round((LEVELS.stop - LEVELS.entry) * 100) === 25, "risk must be 25 ticks");
  assert(Math.round((LEVELS.entry - LEVELS.target) * 100) === 25, "target must be 25 ticks");
  assert(candles.slice(IDX.hl + 1, IDX.trigger).every((c) => c.low > LEVELS.break), "early structure break");
  assert(candles[IDX.trigger].open === LEVELS.break && candles[IDX.trigger].high < LEVELS.entry, "trigger must not fill");
  assert(candles[IDX.fill].open < LEVELS.entry && candles[IDX.fill].high >= LEVELS.entry, "retracement must fill");
  assert(candles.slice(IDX.fill, IDX.exit).every((c) => c.high < LEVELS.stop && c.low > LEVELS.target), "early exit");
  assert(candles[IDX.exit].low <= LEVELS.target && candles[IDX.exit].high < LEVELS.stop, "target must fill before stop");
  for (const step of steps) {
    assert(step.until <= candles.length && step.markers.every((m) => m.index < step.until), "step reveals a future marker");
  }
}
check();

export const story: Story = {
  label: "Step-by-step example of one Tupa Trade short",
  symbol: "CL1! · 1m · example",
  summary: "Synthetic short trade: higher-timeframe bias, higher low, swing high, structure break, stop-limit fill and 25-tick target.",
  candles,
  steps,
};
