// Shared shape of an illustrative step-by-step chart. Synthetic data only: real market data is never published.

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type Tone = "ink" | "dim" | "long" | "short";

// An indicator line drawn over the candles. One value per candle; null = no line at that candle (warm-up or the
// other side of a Supertrend flip).
export type Overlay = { key: string; label: string; tone: Tone; values: (number | null)[] };

export type Step = {
  title: string;
  text: string;
  until: number; // candles shown: indexes 0 .. until - 1
  markers: { index: number; position: "aboveBar" | "belowBar"; shape: "arrowUp" | "arrowDown" | "circle"; text: string }[];
  lines: { price: number; label: string; tone: Tone }[];
  overlays?: string[]; // Overlay keys shown in this step
};

export type Story = {
  label: string; // accessible name of the whole example
  symbol: string; // header text, e.g. "CL1! · 1m · example"
  summary: string; // aria-label of the canvas
  candles: Candle[];
  steps: Step[];
  overlays?: Overlay[];
};
