// Prices and execution levels come from a verified tester replay, never browser calculations.
export type ReplayPoint = { time: number; value: number | null };
export type ReplayLine = { label: string; color: string; points: ReplayPoint[]; pane?: number };
export type ReplayTrade = {
  side: string; entry_time: number; exit_time: number; entry_price: number; exit_price: number;
  profit: number; exit_reason: string;
};
export type TradeReplay = {
  strategy: string; key: string; day: string; slippage: number; generated_utc: string; timezone: "Asia/Kuala_Lumpur";
  params: Record<string, unknown>; filters: unknown[];
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  lines: ReplayLine[]; trades: ReplayTrade[]; notes: string[];
};
