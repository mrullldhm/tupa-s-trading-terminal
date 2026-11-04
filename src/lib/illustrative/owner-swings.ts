// Mandatory 1m transcription of indicators/structure_swings.pine. No settings.
import type { Candle } from "./types.ts";

export function ownerSwings(candles: Candle[]) {
  let lastType = 0;
  let high: number | null = null, low: number | null = null;
  let prevHigh: number | null = null, prevLow: number | null = null;
  let highIndex = -1, lowIndex = -1;
  const push = (type: number, price: number, index: number) => {
    const current = type === 1 ? high : low;
    if (lastType === type && current !== null && (price - current) * type < 0) return;
    if (type === 1) {
      if (lastType !== type) prevHigh = high;
      high = price;
      highIndex = index;
    } else {
      if (lastType !== type) prevLow = low;
      low = price;
      lowIndex = index;
    }
    lastType = type;
  };
  return candles.map((right, i) => {
    if (i >= 2) {
      const left = candles[i - 2], centre = candles[i - 1];
      const isH = left.high <= centre.high && right.high < centre.high;
      const isL = left.low >= centre.low && right.low > centre.low;
      if (isH && isL) {
        const highFirst = centre.high - centre.open < centre.open - centre.low;
        for (const type of highFirst ? [1, -1] : [-1, 1]) push(type, type === 1 ? centre.high : centre.low, i - 1);
      } else if (isH) push(1, centre.high, i - 1);
      else if (isL) push(-1, centre.low, i - 1);
    }
    return { lastType, high, low, prevHigh, prevLow, highIndex, lowIndex };
  });
}
