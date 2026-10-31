// Plain-English names for strategy settings and Feature 2 filters. Meanings: docs/OPTIMIZE.md, feature table.
const TARGET: Record<string, string> = { rr1: "1R", rr2: "2R", near: "near body edge", far: "far body edge" };

export const targetLabel = (v: string) => TARGET[v] ?? v;

const ASSIGN: Record<string, (v: string) => string> = {
  atr_mult: (v) => `move of ${v} × ATR`,
  window: (v) => `${v}-minute setup window`,
  swing: (v) => `swing of ${v} bars`,
  target: (v) => `${targetLabel(v)} target`,
};

const FILTER: Record<string, { min: (v: string) => string; max: (v: string) => string }> = {
  risk_ticks: { min: (v) => `stop at least ${v} ticks`, max: (v) => `stop at most ${v} ticks` },
  risk_atr: { min: (v) => `stop at least ${v} × ATR`, max: (v) => `stop at most ${v} × ATR` },
  anchor_body_atr: { min: (v) => `anchor body at least ${v} × ATR`, max: (v) => `anchor body at most ${v} × ATR` },
  minutes_from_open: { min: (v) => `signal ${v}+ min after the open`, max: (v) => `signal within ${v} min of the open` },
  range_ratio: {
    min: (v) => `previous day's range at least ${v}× its 20-day average`,
    max: (v) => `previous day's range at most ${v}× its 20-day average`,
  },
};

/** "anchor_body_atr >= 0.3, risk_ticks >= 32" -> ["anchor body at least 0.3 × ATR", "stop at least 32 ticks"] */
export function plainSettings(winner: string): string[] {
  return winner.split(",").map((part) => {
    const p = part.trim();
    let m = p.match(/^(\w+)\s*(>=|<=)\s*([\d.]+)$/);
    if (m && FILTER[m[1]]) return FILTER[m[1]][m[2] === ">=" ? "min" : "max"](m[3]);
    m = p.match(/^(\w+)=(\S+)$/);
    if (m && ASSIGN[m[1]]) return ASSIGN[m[1]](m[2]);
    return p;
  });
}

export const samplerLabel = (s: string) => (s === "tpe" ? "Guided search (TPE)" : s === "random" ? "Random search" : s);
