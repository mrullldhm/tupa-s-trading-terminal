// Types and lookups for the JSON written by tools/export_web.py. The site displays these numbers; it never
// recomputes them.
import fpr from "../data/strategies/fair_price_reversal.json";

export type Scenario = {
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number | null;
  commission_paid: number;
  total_closed_trades: number;
  winning_trades: number;
  losing_trades: number;
  percent_profitable: number;
  avg_trade: number;
  avg_winning_trade: number;
  avg_losing_trade: number;
  ratio_avg_win_avg_loss: number | null;
  largest_winning_trade: number;
  largest_losing_trade: number;
  avg_bars_in_trades: number;
  long_trades: number;
  short_trades: number;
  max_equity_drawdown: number;
  max_equity_drawdown_pct: number;
  max_equity_runup: number;
  max_equity_runup_pct: number;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  open_pnl: number;
  commission_per_order: number;
  slippage_ticks: number;
  net_profit_pct: number;
  period_start: string;
  period_end: string;
  long: { net_profit: number; total_closed_trades: number; percent_profitable: number; profit_factor: number | null };
  short: { net_profit: number; total_closed_trades: number; percent_profitable: number; profit_factor: number | null };
  exit_reasons: Record<string, number>;
};

export type Curve = [string, number][];
export type Scenarios = Record<"0" | "1" | "2", Scenario>;

export type F1Variant = {
  params: Record<string, string | number>;
  grid_size: number;
  scenarios: Scenarios;
  curve_month_end_closed_pnl: Record<"0" | "1" | "2", Curve>;
  by_year_0_ticks: { year: number; trades: number; net_profit: number; percent_profitable: number; profit_factor: number | null }[];
};

export type F2Run = {
  run_id: string;
  variant: string;
  space: string;
  sampler: string;
  objective: string;
  seed: number;
  trials: number;
  duplicates: number;
  eligible: number;
  evaluations: number;
  winner: string;
  time_utc: string;
  params: Record<string, string | number>;
  filters: [string, "min" | "max", number][];
  interval: [string | null, string | null];
  source_trial: number;
  scenarios: Scenarios;
  curve_month_end_closed_pnl_1_tick: Curve;
};

export type StrategyData = {
  export_version: number;
  generated_utc: string;
  strategy: string;
  features: {
    f1: { variants: Record<string, F1Variant>; grid_size: number[] };
    f2: {
      runs: F2Run[];
      total_trials: number;
      total_engine_evaluations: number;
      manual_looks: { time_utc: string; evaluations: number; note: string }[];
      lineage: string[];
    } | null;
    f3: unknown | null;
  };
  sources: { path: string; sha256: string }[];
};

const EXPORT_VERSION = 1;
export const MIN_ELIGIBLE_TRADES = 300; // docs/OPTIMIZE.md: a trial counts only with 300+ closed trades at 1 tick

const all: Record<string, StrategyData> = {
  fair_price_reversal: fpr as unknown as StrategyData,
  supertrend_kalman: skm as unknown as StrategyData,
};

export function strategyData(key: string): StrategyData {
  const d = all[key];
  if (!d) throw new Error(`no exported data for strategy "${key}"; run npm run export`);
  if (d.export_version !== EXPORT_VERSION) throw new Error(`${key}: export version ${d.export_version}, site expects ${EXPORT_VERSION}`);
  checkShape(key, d);
  return d;
}

// Fail the build with a clear message on a malformed export, instead of a crash deep inside a component.
// Unavailable features are null (f2, f3); a present feature must be complete.
const SCENARIO_KEYS = ["0", "1", "2"] as const;
function checkShape(key: string, d: StrategyData) {
  const bad = (msg: string) => {
    throw new Error(`${key}: malformed export, ${msg}; re-run npm run export`);
  };
  const variants = Object.entries(d.features?.f1?.variants ?? {});
  if (!variants.length) bad("features.f1.variants is empty");
  for (const [v, x] of variants) {
    for (const k of SCENARIO_KEYS) {
      if (!x.scenarios?.[k]) bad(`f1.${v} has no scenario "${k}"`);
      if (!Array.isArray(x.curve_month_end_closed_pnl?.[k])) bad(`f1.${v} has no curve for scenario "${k}"`);
    }
    if (!Array.isArray(x.by_year_0_ticks)) bad(`f1.${v}.by_year_0_ticks is missing`);
  }
  for (const r of d.features.f2?.runs ?? []) {
    for (const k of SCENARIO_KEYS) if (!r.scenarios?.[k]) bad(`f2 run ${r.run_id} has no scenario "${k}"`);
    if (!Array.isArray(r.curve_month_end_closed_pnl_1_tick)) bad(`f2 run ${r.run_id} has no 1-tick curve`);
  }
}

export const SESSION_LABEL: Record<string, string> = { all: "All hours", asia: "Asia", london: "London", ny: "New York" };
export const SESSION_ORDER = ["all", "ny", "london", "asia"];

export function sessionLabel(key: string): string {
  const label = SESSION_LABEL[key];
  if (!label) throw new Error(`unknown session "${key}"; add it to SESSION_LABEL and SESSION_ORDER`);
  return label;
}
