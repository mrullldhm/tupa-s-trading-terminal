// Ports of tvtester/ta.py (Pine semantics) used only to build and check illustrative charts at build time. NaN marks
// warm-up, as in the Python. Keep these in step with ta.py: the checks rely on them meaning the same thing.

export function tr(h: number[], l: number[], c: number[]): number[] {
  return h.map((hi, i) => (i === 0 ? hi - l[i] : Math.max(hi - l[i], Math.abs(hi - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
}

// ta.rma: seeded with the SMA of the first `length` values, then alpha = 1 / length.
export function rma(x: number[], length: number): number[] {
  const out = x.map(() => NaN);
  if (x.length < length) return out;
  let v = x.slice(0, length).reduce((a, b) => a + b, 0) / length;
  out[length - 1] = v;
  for (let i = length; i < x.length; i++) {
    v = x[i] / length + (1 - 1 / length) * v;
    out[i] = v;
  }
  return out;
}

export const atr = (h: number[], l: number[], c: number[], length: number) => rma(tr(h, l, c), length);

// ta.supertrend(factor, atrLen): direction -1 = up trend, +1 = down trend (Pine).
export function supertrend(h: number[], l: number[], c: number[], factor: number, atrLen: number) {
  const a = atr(h, l, c, atrLen);
  const line: number[] = [];
  const dir: number[] = [];
  let ubPrev = 0;
  let lbPrev = 0;
  let stPrev = NaN;
  for (let i = 0; i < c.length; i++) {
    const src = (h[i] + l[i]) / 2;
    let ub = src + factor * a[i];
    let lb = src - factor * a[i];
    const cp = i > 0 ? c[i - 1] : NaN;
    lb = lb > lbPrev || cp < lbPrev ? lb : lbPrev;
    ub = ub < ubPrev || cp > ubPrev ? ub : ubPrev;
    let d: number;
    if (i === 0 || Number.isNaN(a[i - 1])) d = 1;
    else if (stPrev === ubPrev) d = c[i] > ub ? -1 : 1;
    else d = c[i] < lb ? 1 : -1;
    const st = d === -1 ? lb : ub;
    line.push(st);
    dir.push(d);
    stPrev = st;
    ubPrev = Number.isNaN(ub) ? 0 : ub;
    lbPrev = Number.isNaN(lb) ? 0 : lb;
  }
  return { line, dir };
}

// UT Bot ATR trailing stop, close source.
export function atrTrailingStop(c: number[], nLoss: number[]): number[] {
  const stop: number[] = [];
  let p = 0;
  for (let i = 0; i < c.length; i++) {
    const s = c[i];
    const s1 = i > 0 ? c[i - 1] : NaN;
    const nl = nLoss[i];
    let v: number;
    if (Number.isNaN(nl)) v = NaN;
    else if (s > p && s1 > p) v = Math.max(p, s - nl);
    else if (s < p && s1 < p) v = Math.min(p, s + nl);
    else if (s > p) v = s - nl;
    else v = s + nl;
    stop.push(v);
    p = Number.isNaN(v) ? 0 : v;
  }
  return stop;
}

// 2-state constant-velocity Kalman filter (level, slope), Joseph update, z in dollars, P0 = 100 I.
export function kalmanTrend(z: number[], q: number, r = 1) {
  const level: number[] = z.map(() => NaN);
  const slope: number[] = z.map(() => NaN);
  if (!z.length) return { level, slope };
  let x0 = z[0];
  let x1 = 0;
  let a = 100;
  let b = 0;
  let d = 100;
  level[0] = x0;
  slope[0] = x1;
  for (let i = 1; i < z.length; i++) {
    x0 = x0 + x1;
    [a, b, d] = [a + 2 * b + d + 0.25 * q, b + d + 0.5 * q, d + q];
    const s = a + r;
    const k0 = a / s;
    const k1 = b / s;
    const y = z[i] - x0;
    x0 += k0 * y;
    x1 += k1 * y;
    const a2 = (1 - k0) ** 2 * a + k0 * k0 * r;
    const b2 = (1 - k0) * (b - k1 * a) + k0 * k1 * r;
    const d2 = k1 * k1 * a - 2 * k1 * b + d + k1 * k1 * r;
    [a, b, d] = [a2, b2, d2];
    level[i] = x0;
    slope[i] = x1;
  }
  return { level, slope };
}

// Pivot confirmed at bar i when bar i - strength is strictly above (high) / below (low) every bar within `strength`
// bars on each side. Returns the pivot value at its confirmation bar, NaN elsewhere.
export function bufferPivots(x: number[], strength: number, high: boolean): number[] {
  const out = x.map(() => NaN);
  for (let i = 2 * strength; i < x.length; i++) {
    const j = i - strength;
    let ok = true;
    for (let k = -strength; k <= strength && ok; k++) {
      if (k !== 0) ok = high ? x[j] > x[j + k] : x[j] < x[j + k];
    }
    if (ok) out[i] = x[j];
  }
  return out;
}
