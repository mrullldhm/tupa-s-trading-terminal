// Types and lookups for the JSON written by tools/export_web.py. The site displays these numbers; it never
// recomputes them.
import fpr from "../data/strategies/fair_price_reversal.json";
import skm from "../data/strategies/supertrend_kalman.json";
import { SCENARIO_KEYS, isPeriodTable, type PeriodTable } from "./periods";

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
  periods_year: PeriodTable;
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
  curve_month_end_closed_pnl: Record<"0" | "1" | "2", Curve>;
  periods_year: PeriodTable | null;
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
    f3: { runs: F3Run[]; total_engine_runs: number } | null;
    f4: null;
    f5: null;
  };
  sources: { path: string; sha256: string }[];
};

export const EXPORT_VERSION = 3;
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
// Unavailable features are null (f2 to f5); a present feature must be complete.
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
    if (!isPeriodTable(x.periods_year)) bad(`f1.${v}.periods_year is malformed`);
  }
  for (const r of d.features.f2?.runs ?? []) {
    for (const k of SCENARIO_KEYS) if (!r.scenarios?.[k]) bad(`f2 run ${r.run_id} has no scenario "${k}"`);
    for (const k of SCENARIO_KEYS) if (!Array.isArray(r.curve_month_end_closed_pnl?.[k])) bad(`f2 run ${r.run_id} has no curve for "${k}"`);
    if (r.periods_year !== null && !isPeriodTable(r.periods_year)) bad(`f2 run ${r.run_id}.periods_year is malformed`);
  }
  for (const r of d.features.f3?.runs ?? []) {
    if (!r.verdict || !r.wfo_total || !Array.isArray(r.folds) || !r.folds.length) bad(`f3 run ${r.tag} is incomplete`);
    if (r.verdict.advance !== (r.verdict.procedure && r.verdict.candidate)) bad(`f3 run ${r.tag}: advance must be procedure AND candidate`);
  }
}

type Sc = { "0": number; "1": number; "2": number };
type Dsr = { dsr: number | null; sr0: number; n: number };
type Pbo = { pbo: number | null; p_oos_loss: number | null; median_logit: number | null; splits: number; skipped: number };
/** One F3 validation run (docs/VALIDATE.md), as written by the tester. */
export type F3Run = {
  tag: string;
  variant: string;
  time_utc: string;
  candidate_trial: number;
  universe: number;
  filters: [string, "min" | "max", number][];
  source_search: string;
  fold_years: number[];
  rules: { min_positive_folds: number; pbo_max: number; dsr_min: number };
  engine_runs: number;
  verdict: {
    procedure: boolean;
    candidate: boolean;
    advance: boolean;
    procedure_checks: { wfo_net1: boolean; wfo_net2: boolean; folds: boolean; pbo: boolean };
    candidate_checks: { dsr: boolean };
  };
  wfo_total: Sc;
  wfo_trades1: number;
  positive_folds: number;
  folds: { year: number; trial: number | null; picked: string | null; train_obj: number | null; net0: number; net1: number; net2: number; trades1: number; cand1: number }[];
  rolling_total: Sc;
  pbo: { primary: Pbo; eligible_only: Pbo; ticks2: Pbo; identical_paths: number };
  dsr: { sr: number | null; skew: number | null; kurt: number | null; days: number; primary: Dsr; variant_n: Dsr; strategy_n: Dsr; ticks2: Dsr; monthly: Dsr; psr0: number | null; boot90: [number, number] | null };
};

export const SESSION_LABEL: Record<string, string> = { all: "All hours", asia: "Asia", london: "London", ny: "New York" };
export const SESSION_ORDER = ["all", "ny", "london", "asia"];

export function sessionLabel(key: string): string {
  const label = SESSION_LABEL[key];
  if (!label) throw new Error(`unknown session "${key}"; add it to SESSION_LABEL and SESSION_ORDER`);
  return label;
}
