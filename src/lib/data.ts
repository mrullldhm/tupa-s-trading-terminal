import research from "../data/research.json";
import { STRATEGY_TEXT, textFor } from "../data/strategies";

export interface Variant {
  strategy: string;
  label: string;
  hash: string;
  period: string;
  run_utc: string;
  trades: number;
  net: number;
  profit_factor: number;
  win_rate: number;
  max_drawdown: number;
  pass_rate: number;
  seq_passes: number;
  seq_fails: number;
  cost_per_pass: number | null;
  years_positive: number;
  years_total: number;
  best_of: number;
  years: { year: number; net: number }[];
  equity: { month: string; net: number }[];
  exits: Record<string, number>;
}

export const R = research as unknown as {
  exported_utc: string;
  ledger_rows: number;
  first_run_utc: string;
  last_run_utc: string;
  periods: Record<string, { start: string; end: string | null }>;
  gates: { trades: number; profit_factor: number; years_positive: number; pass_rate: number; cost_per_pass: number };
  combine: {
    name: string;
    start_balance: number;
    profit_target: number;
    max_loss: number;
    consistency: number;
    max_contracts: number;
    monthly_fee: number;
    reset_fee: number;
    fee_round_turn: number;
  };
  strategies: { id: string; status: { state: string; date: string; reason: string } }[];
  variants: Variant[];
};

// Fixed colour per strategy (validated categorical set, dark surface). Colour follows the entity, never its rank.
const COLORS: Record<string, string> = {
  purple_pa: "#3987e5",
  swapnil_hm: "#d95926",
  xtley_gap: "#199e70",
  swapnil_momentum: "#c98500",
  scribd_supertrend: "#d55181",
  ict_ea: "#9085e9",
  swing_point_failure: "#008300",
  swing_point_failure_reversal: "#2aa1b3",
  swing_point_manipulation: "#008300",
  purple_levels: "#3987e5",
  pd_swing: "#c98500",
};

// The palette has eight validated hues; a ninth strategy reuses one and is drawn dashed (striped swatch), so identity
// never rests on colour alone.
const DASHED = new Set(["swing_point_manipulation", "purple_levels", "pd_swing"]);

/** Inline style for a strategy swatch: solid, or striped when the strategy is drawn dashed. */
export const swatch = (color: string, dash = false) =>
  dash ? `background:repeating-linear-gradient(90deg,${color} 0 3px,transparent 3px 5px)` : `background:${color}`;

/** Same validated set, in fixed order, for variants inside one strategy page. */
export const VARIANT_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];

export interface VariantStyle { color: string; dash: boolean }

/** Colour and line style per variant hash. Colour follows stop and target; versions that differ only in their tie
 * rule share one colour (same settings). 4-hour swing versions and strict-swing versions are dashed, so one colour
 * covers both. */
// Neutral for versions folded into "Other" (opaque ink-3 on the ink-blue ground); never a ninth hue.
const OTHER_COLOR = "#7c818c";
const MANIPULATION_FAMILY = /^stop ≤15 ticks · strict swings · waits one 15m candle(?: · target (\d+) ticks)?$/;
const MANIPULATION_TARGETS = ["swing", "15", "30", "45", "60", "75"];

/** Swing Point Manipulation has 14 versions: the six targets of the 15-tick, strict, wait-one-candle family keep the
 * six colours (by target, fixed); every other version is a grey "Other" line, dashed when it uses strict swings. */
function manipulationStyle(label: string): VariantStyle {
  const m = label.match(MANIPULATION_FAMILY);
  const slot = m ? MANIPULATION_TARGETS.indexOf(m[1] ?? "swing") : -1;
  if (slot >= 0) return { color: VARIANT_COLORS[slot], dash: false };
  return { color: OTHER_COLOR, dash: label.includes("strict swings") };
}

export function variantStyles(vs: Variant[]): Map<string, VariantStyle> {
  const byGroup = new Map<string, string>();
  const byHash = new Map<string, VariantStyle>();
  for (const v of vs) {
    if (v.strategy === "swing_point_manipulation") {
      byHash.set(v.hash, manipulationStyle(v.label));
      continue;
    }
    const group = v.label.replace(/ · tie \S+$/, "").replace(/^\S+ swings · /, "")
      .replace(/ · (strict swings|outside-candle high ignored)/, "");
    if (!byGroup.has(group)) byGroup.set(group, VARIANT_COLORS[byGroup.size % VARIANT_COLORS.length]);
    const dash = v.label.startsWith("4h swings") || v.label.includes("strict swings");
    byHash.set(v.hash, { color: byGroup.get(group)!, dash });
  }
  return byHash;
}

export const yearRange = () => {
  const d = R.periods.dev;
  return `${d.start.slice(0, 4)}–${Number(d.end!.slice(0, 4)) - 1}`;
};

export interface Gate {
  key: string;
  label: string;
  rule: string;
  value: string;
  pass: boolean;
}

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export function gates(v: Variant): Gate[] {
  const g = R.gates;
  const yp = v.years_positive / v.years_total;
  return [
    { key: "trades", label: "Trades", rule: `${g.trades}+`, value: v.trades.toLocaleString("en-US"), pass: v.trades >= g.trades },
    { key: "pf", label: "Profit factor", rule: `${g.profit_factor.toFixed(2)}+`, value: v.profit_factor.toFixed(2), pass: v.profit_factor >= g.profit_factor },
    { key: "years", label: "Years in profit", rule: `${Math.round(g.years_positive * 100)}%+`, value: `${v.years_positive}/${v.years_total}`, pass: yp >= g.years_positive },
    { key: "pass", label: "Combine pass rate", rule: `${Math.round(g.pass_rate * 100)}%+`, value: `${(v.pass_rate * 100).toFixed(1)}%`, pass: v.pass_rate >= g.pass_rate },
    { key: "cost", label: "Cost per pass", rule: `≤ ${money(g.cost_per_pass)}`, value: v.cost_per_pass == null ? "no pass" : money(v.cost_per_pass), pass: v.cost_per_pass != null && v.cost_per_pass <= g.cost_per_pass },
  ];
}

export const gatesPassed = (v: Variant) => gates(v).filter((x) => x.pass).length;

export interface Strategy {
  id: string;
  slug: string;
  name: string;
  short: string;
  color: string;
  dash: boolean;
  status: { state: string; date: string; reason: string };
  variants: Variant[];
  checks: Variant[];
  best: Variant;
  text: ReturnType<typeof textFor>;
}

export const isStrictFills = (v: Variant) => v.label.endsWith("strict fills");

/** Best variant = most gates passed, then highest profit factor. Labelled "best of N" wherever shown. */
const rank = (a: Variant, b: Variant) => gatesPassed(b) - gatesPassed(a) || b.profit_factor - a.profit_factor;

export const strategies: Strategy[] = STRATEGY_TEXT.map((t) => {
  const variants = R.variants.filter((v) => v.strategy === t.id && v.period === "dev");
  const checks = R.variants.filter((v) => v.strategy === t.id && v.period === "validation");
  const status = R.strategies.find((s) => s.id === t.id)?.status;
  if (!variants.length || !status) throw new Error(`No exported runs for ${t.id}`);
  // Strict-fill runs are a sensitivity check of the owner's fill rule, never the headline version.
  const ownerFills = variants.filter((v) => !isStrictFills(v));
  const best = [...(ownerFills.length ? ownerFills : variants)].sort(rank)[0];
  return { id: t.id, slug: t.slug, name: t.name, short: t.short, color: COLORS[t.id], dash: DASHED.has(t.id), status, variants, checks, best, text: t };
}).sort((a, b) => rank(a.best, b.best));

export const strategyById = (id: string) => strategies.find((s) => s.id === id)!;

export const totals = {
  strategies: strategies.length,
  variants: R.variants.filter((v) => v.period === "dev").length,
  runs: R.ledger_rows,
  passed: strategies.filter((s) => gates(s.best).every((g) => g.pass)).length,
  tradesTested: R.variants.reduce((n, v) => n + v.trades, 0),
};

/** Cumulative net by month. */
export function curve(v: Variant): { t: string; y: number }[] {
  let c = 0;
  return v.equity.map((p) => ({ t: p.month, y: (c += p.net) }));
}
