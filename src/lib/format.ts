const MINUS = "−";

/** Signed USD. The sign always shows, so colour is never the only signal. */
export function usd(v: number | null | undefined, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (v == null) return "—";
  const { sign = true, cents = false } = opts;
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  if (!sign || Math.abs(v) < 0.5) return `$${abs}`;
  return `${v > 0 ? "+" : MINUS}$${abs}`;
}

/** Compact signed USD: +$14.5K, −$326K. */
export function usdK(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}K` : `$${Math.round(a)}`;
  return a < 0.5 ? s : `${v > 0 ? "+" : MINUS}${s}`;
}

export const int = (v: number) => v.toLocaleString("en-US");
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export function date(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
}
