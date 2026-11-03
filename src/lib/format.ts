const MINUS = "−";

/** Signed USD, e.g. +42,475.80 / −20,100.08. The sign is always shown so colour is never the only signal. */
export function usd(v: number | null | undefined, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (v == null) return "—";
  const { sign = true, cents = true } = opts;
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (!sign || Math.abs(v) < (cents ? 0.005 : 0.5)) return `$${abs}`;
  return `${v > 0 ? "+" : MINUS}$${abs}`;
}

export function num(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return v < 0 && Number(v.toFixed(digits)) !== 0 ? `${MINUS}${s}` : s;
}

export function int(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("en-US");
}

export function pct(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : `${num(v, digits)}%`;
}

export function tone(v: number | null | undefined): "pos" | "neg" | "" {
  if (v == null || Math.abs(v) < 0.005) return "";
  return v > 0 ? "pos" : "neg";
}

export function date(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
}
