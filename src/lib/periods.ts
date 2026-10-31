// Shared by the build and the browser, so it must not import the strategy JSON.
// Net profit per UTC exit period at 0, 1 and 2 ticks (tvtester.metrics.by_period). null = no exit in that period
// at that slippage. Year tables are embedded; month, week and day tables are fetched on demand.
export const SCENARIO_KEYS = ["0", "1", "2"] as const;
export const FETCHED_GRAINS = ["month", "week", "day"] as const;
export type FetchedGrain = (typeof FETCHED_GRAINS)[number];

export type PeriodTable = { periods: string[]; net: Record<(typeof SCENARIO_KEYS)[number], (number | null)[]> };
export type PeriodFile = PeriodTable & { export_version: number; strategy: string; key: string; grain: string };

export function periodFileUrl(strategy: string, key: string, grain: FetchedGrain): string {
  return `/data/${strategy}/${key}/${grain}.json`;
}

export function isPeriodTable(t: unknown): t is PeriodTable {
  if (!t || typeof t !== "object") return false;
  const { periods, net } = t as Partial<PeriodTable>;
  if (!Array.isArray(periods) || !periods.every((p) => typeof p === "string") || !net || typeof net !== "object") return false;
  return SCENARIO_KEYS.every((k) => {
    const col = (net as Record<string, unknown>)[k];
    return Array.isArray(col) && col.length === periods.length && col.every((v) => v === null || typeof v === "number");
  });
}
