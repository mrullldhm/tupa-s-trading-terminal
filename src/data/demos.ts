// Hand-written walk-through text for each strategy's worked example. Numbers come from demos.json, which
// web/tools/export_demos.py builds by running the real strategy code and engine on made-up candles.
import demos from "./demos.json";

export interface DemoCandle { o: number; h: number; l: number; c: number; t: string; d: string; nd: boolean }
export interface DemoLine { key: string; name: string; color: string; dash?: boolean; step?: boolean; values: (number | null)[] }
export interface DemoPane { key: string; title: string; lo: number | null; hi: number | null; guides: { v: number; label: string }[]; lines: DemoLine[] }
export interface DemoMark {
  kind: "hline" | "zone" | "candle";
  layer: string;
  label: string;
  price?: number;
  from?: number;
  to?: number;
  i?: number;
  i0?: number;
  i1?: number;
  lo?: number;
  hi?: number;
  tone?: string;
  faint?: boolean;
}
export interface DemoTrade {
  side: 1 | -1;
  qty: number;
  signal: number;
  entry_i: number;
  exit_i: number;
  limit: number;
  entry: number;
  exit: number;
  stop: number;
  target: number | null;
  reason: string;
  ticks: number;
  net: number;
  fee: number;
  part_exit: number | null;
  part_qty: number;
  part_target: number | null;
  /** [position in candles (index + fraction of the candle's minutes), stop] at each change; last entry = exit, stop null. */
  stop_path: [number, number | null][];
  risk_ticks: number;
  expire_min: number | null;
}
export interface Demo {
  id: string;
  variant: string;
  tf: string;
  candles: DemoCandle[];
  overlays: DemoLine[];
  panes: DemoPane[];
  marks: DemoMark[];
  trade: DemoTrade;
  facts: Record<string, any>;
}

export interface Check { label: string; value: string; ok: boolean }
export interface Step {
  title: string;
  text: string;
  at: number; // candle the replay has reached
  show: string[]; // chart layers visible at this step
  checks?: Check[];
}

const D = (demos as unknown as { demos: Record<string, Demo> }).demos;
export const demoFor = (id: string): Demo | null => D[id] ?? null;

const $ = (v: number) => `$${v.toFixed(2)}`;
const money = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n1 = (v: number) => v.toFixed(1);
const ticks = (n: number) => `${n} tick${n === 1 ? "" : "s"} ($${(n * 10).toLocaleString("en-US")})`;
const TF: Record<string, string> = { "1m": "1-minute", "5m": "5-minute", "15m": "15-minute", "30m": "30-minute", "1h": "1-hour", "4h": "4-hour" };
export const tfWords = (tf: string) => TF[tf] ?? tf;

/** Did manage() actually move the stop during the example? */
const stops = (t: DemoTrade) => t.stop_path.flatMap((p) => (p[1] == null ? [] : [{ at: p[0], v: p[1] }]));
export const stopMoved = (t: DemoTrade) => stops(t).some((s) => s.v !== t.stop);

const L = ["setup", "touch", "signal"];
function orderStep(d: Demo, how: string): Step {
  const t = d.trade;
  const buy = t.side === 1;
  const tgt = t.target != null ? ` Target: ${$(t.target)}.` : " No fixed target: the exit comes from the trade rules.";
  return {
    title: "Place the order",
    text: `${how} A ${buy ? "buy" : "sell"} limit order goes in at ${$(t.limit)}. Stop: ${$(t.stop)}, which risks ${ticks(t.risk_ticks)} per contract.${tgt}${t.qty > 1 ? ` Size: ${t.qty} contracts.` : ""}`,
    at: t.signal,
    show: [...L, "order"],
  };
}
function fillStep(d: Demo, wait: string): Step {
  const t = d.trade;
  const later = t.entry_i - t.signal;
  return {
    title: "Order fills",
    text: `${later <= 1 ? "On the next candle" : `${later} candles later`} price trades back to ${$(t.limit)} and the order fills at ${$(t.entry)}. A touch is enough to fill (owner rule). ${wait}`,
    at: t.entry_i,
    show: [...L, "order", "fill"],
  };
}
function manageStep(d: Demo, how: string): Step | null {
  const t = d.trade;
  if (!stopMoved(d.trade)) return null;
  const s = stops(t);
  const last = s.at(-1)!.v;
  const at = Math.floor(s.find((p) => p.v !== t.stop)?.at ?? t.entry_i);
  return { title: "The stop moves", text: `${how} By the end the stop sits at ${$(last)} instead of ${$(t.stop)}.`, at: Math.max(at, t.entry_i), show: [...L, "order", "fill", "manage"] };
}
function exitStep(d: Demo): Step {
  const t = d.trade;
  const buy = t.side === 1;
  const moved = stopMoved(t);
  const lockedIn = moved && (t.exit - t.entry) * t.side > 0;
  const why: Record<string, string> = {
    target: `Price reaches the target at ${$(t.exit)}.`,
    stop: lockedIn ? `Price turns and hits the moved stop at ${$(t.exit)}, so the trade still ends in profit.` : `Price hits the stop at ${$(t.exit)}.`,
    flatten: `It is 3:10 PM Chicago time, so the trade closes at ${$(t.exit)} (Topstep closes every position then).`,
    manage: `The trade rules close it at ${$(t.exit)}.`,
    day_end: `The session ends and the trade closes at ${$(t.exit)}.`,
  };
  const part = t.part_exit != null ? ` Earlier, ${t.part_qty} of the ${t.qty} contracts took part profit at ${$(t.part_exit)}.` : "";
  return {
    title: "Trade ends",
    text: `${why[t.reason] ?? `It closes at ${$(t.exit)}.`}${part} Result: ${money(t.net)} after the ${$(t.fee)} fee${t.qty > 1 ? "s" : ""}. ${buy ? "Bought" : "Sold"} at ${$(t.entry)}, out at ${$(t.exit)}.`,
    at: d.candles.length - 1,
    show: [...L, "order", "fill", "manage", "exit"],
  };
}
const above = (a: number, b: number, side: number) => (a - b) * side > 0;

type Builder = (d: Demo) => Step[];

const BUILD: Record<string, Builder> = {
  purple_pa: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    return [
      { title: "Mark yesterday's levels", text: `Before the session we mark yesterday's high and low. The dotted line is yesterday's ${f.level_name} at ${$(f.level)}. We only trade the first time price comes back to it.`, at: Math.max(0, f.touch - 1), show: ["setup"] },
      { title: "First touch", text: `This candle ${buy ? "dips to" : "rises to"} yesterday's ${f.level_name}. It is the first touch today, so the level is live. Coming from ${buy ? "above, it may act as a floor: we look to buy" : "below, it may act as a ceiling: we look to sell"}.`, at: f.touch, show: ["setup", "touch"] },
      {
        title: "Wait for proof",
        text: `Within ${f.expire_candles} candles, a gap opens (shaded): the third candle's ${buy ? "low" : "high"} stays ${buy ? "above" : "below"} the first candle's ${buy ? "high" : "low"}. Price left the level fast. That gap is the proof that ${buy ? "buyers" : "sellers"} stepped in.`,
        at: f.gap_to,
        show: ["setup", "touch", "signal"],
        checks: [
          { label: "First touch of the level today", value: "yes", ok: true },
          { label: `Gap ${buy ? "up" : "down"} within ${f.expire_candles} candles`, value: `${f.candles_after} candles after the touch`, ok: true },
          { label: "Gap size", value: `${$(f.gap_lo)} to ${$(f.gap_hi)}`, ok: true },
        ],
      },
      orderStep(d, `The entry is the edge of the gap. The stop goes 1 tick past the ${buy ? "lowest low" : "highest high"} since the touch, and the target is the same distance the other way (1 : 1). The order stays live for ${f.expire_candles} candles.`),
      fillStep(d, "From here only the stop or the target can end it, or 3:10 PM."),
      exitStep(d),
    ];
  },
  swapnil_hm: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    const steps: (Step | null)[] = [
      { title: "Read the indicators", text: `Price pane: the 20-candle average (blue) and today's VWAP (gold). Below: RSI 14 with lines at ${f.rsi_buy} and ${f.rsi_sell}, and RSI 9 drawn as a fast and a slow line. We wait for all four to agree.`, at: Math.max(0, t.signal - 6), show: [] },
      {
        title: "All four agree",
        text: `This candle closes with every condition true, so it is a ${buy ? "buy" : "sell"} signal.`,
        at: t.signal,
        show: ["signal"],
        checks: [
          { label: `RSI 14 ${buy ? "above" : "below"} ${buy ? f.rsi_buy : f.rsi_sell}`, value: n1(f.rsi), ok: buy ? f.rsi > f.rsi_buy : f.rsi < f.rsi_sell },
          { label: `Fast RSI line ${buy ? "above" : "below"} slow line`, value: `${n1(f.fast)} vs ${n1(f.slow)}`, ok: above(f.fast, f.slow, t.side) },
          { label: `Close ${buy ? "above" : "below"} 20-candle average`, value: `${$(f.close)} vs ${$(f.basis)}`, ok: above(f.close, f.basis, t.side) },
          { label: `Close ${buy ? "above" : "below"} VWAP`, value: `${$(f.close)} vs ${$(f.vwap)}`, ok: above(f.close, f.vwap, t.side) },
        ],
      },
      orderStep(d, "The entry is the signal candle's close, live for one candle. Stop and target are the source's yen distances, scaled to oil by percent of price."),
      fillStep(d, ""),
      manageStep(d, "As in the source code, after every finished candle the stop is reset from that candle's open or close."),
      exitStep(d),
    ];
    return steps.filter(Boolean) as Step[];
  },
  xtley_gap: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    const steps: (Step | null)[] = [
      { title: "Read the indicators", text: `Price pane: the long average EMA 360 (blue), a dashed line ${f.gap_pct}% away from it, and EMA 20 (gold). Below: RSI 20, and the calm check (short ATR under long ATR means a quiet market).`, at: Math.max(0, t.signal - 8), show: [] },
      {
        title: "Stretched, calm, turning",
        text: `Price is far ${buy ? "below" : "above"} its long average but has already crossed back over EMA 20. The market is calm. That is a ${buy ? "buy" : "sell"} signal: bet on the drift back toward the average.`,
        at: t.signal,
        show: ["signal"],
        checks: [
          { label: `More than ${f.gap_pct}% ${buy ? "below" : "above"} EMA 360`, value: `${f.dist_pct.toFixed(2)}% (${$(f.close)} vs ${$(f.e360)})`, ok: f.dist_pct > f.gap_pct },
          { label: `Close back ${buy ? "above" : "below"} EMA 20`, value: `${$(f.close)} vs ${$(f.e20)}`, ok: above(f.close, f.e20, t.side) },
          { label: `RSI ${buy ? "falling" : "rising"} (as the source wrote it)`, value: `${n1(f.rsi_prev)} to ${n1(f.rsi)}`, ok: buy ? f.rsi < f.rsi_prev : f.rsi > f.rsi_prev },
          { label: "Calm market: ATR 10 under ATR 20", value: `${f.a10.toFixed(3)} vs ${f.a20.toFixed(3)}`, ok: f.a10 < f.a20 },
        ],
      },
      orderStep(d, `The limit sits ${f.offset} ticks better than the close and stays live for 5 candles. Stop: ${f.sl_atr} × ATR. Target: ${f.rr} times the stop distance.`),
      fillStep(d, f.trail ? "The trailing stop starts after the trade gains one stop-size." : "This version has no trailing stop."),
      manageStep(d, `Each time the trade gains one more stop-size, the stop steps up behind it (and never closer than ${f.trail_atr} × ATR).`),
      exitStep(d),
    ];
    return steps.filter(Boolean) as Step[];
  },
  swapnil_momentum: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    const word = buy ? "up" : "down";
    return [
      { title: "Watch candle colours", text: `No indicators. Only the colour of each finished candle counts: closed above its open (light) or below it (dark).`, at: Math.max(0, f.first - 3), show: [] },
      {
        title: `Two ${word} candles`,
        text: `Two ${buy ? "up" : "down"} candles in a row close. The idea says momentum carries on, so it is a ${buy ? "buy" : "sell"} signal.`,
        at: t.signal,
        show: ["signal"],
        checks: [
          { label: `Candle 1 ${buy ? "up" : "down"}`, value: buy ? "close above open" : "close below open", ok: true },
          { label: `Candle 2 ${buy ? "up" : "down"}`, value: buy ? "close above open" : "close below open", ok: true },
        ],
      },
      orderStep(d, `The entry is candle 2's close. The stop goes just past candle 2 (${f.x_pct}% of price beyond its ${buy ? "low" : "high"}). The stop is ${f.risk_pct}% of price, so the source rule sets the target at ${f.y} × the stop.`),
      fillStep(d, ""),
      exitStep(d),
    ];
  },
  scribd_supertrend: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    const steps: (Step | null)[] = [
      { title: "Read the three trend tools", text: `Price pane: Supertrend (green under price in an uptrend, rose above it in a downtrend), EMA 8 (gold) and EMA 21 (blue). Below: Vortex, buyers' line VI+ and sellers' line VI-.`, at: Math.max(0, t.signal - 8), show: [] },
      {
        title: "All three agree",
        text: `This candle is the first in a row where all three point ${buy ? "up" : "down"}. That is a ${buy ? "buy" : "sell"} signal.`,
        at: t.signal,
        show: ["signal"],
        checks: [
          { label: `Supertrend ${buy ? "up" : "down"}`, value: `line at ${$(f.st)}`, ok: f.dir === t.side },
          { label: `EMA 8 ${buy ? "above" : "below"} EMA 21`, value: `${$(f.e8)} vs ${$(f.e21)}`, ok: above(f.e8, f.e21, t.side) },
          { label: `${buy ? "VI+" : "VI-"} above 1.1`, value: (buy ? f.vp : f.vm).toFixed(3), ok: (buy ? f.vp : f.vm) > 1.1 },
          { label: `${buy ? "VI-" : "VI+"} below 0.9`, value: (buy ? f.vm : f.vp).toFixed(3), ok: (buy ? f.vm : f.vp) < 0.9 },
        ],
      },
      orderStep(d, `The entry is the signal close, live for one candle. Stop: ATR (${$(f.atr)}) plus ${f.stop_pts} points. The document's rupee points become oil dollars by price: 1 point ≈ ${$(f.pt)} here.${f.exit === "fixed" ? ` This version takes a fixed ${f.target_pts}-point target (${$(f.target_usd)}).` : ""}`),
      fillStep(d, f.exit === "trail" ? `After +${f.trail_pts} points (${$(f.trail_usd)}) a trailing stop follows one ATR behind price.` : ""),
      manageStep(d, `After +${f.trail_pts} points the stop trails one ATR behind the last close.`),
      exitStep(d),
    ];
    return steps.filter(Boolean) as Step[];
  },
  ict_ea: (d) => {
    const f = d.facts, t = d.trade, buy = t.side === 1;
    const parts = f.parts as { key: string; label: string; pts: number; note: string }[];
    const steps: (Step | null)[] = [
      { title: "Map the structure", text: `On 1-hour candles we find swing highs and lows with the owner's swing rule. The lines are the last swing high and low as known right now, and the middle between them splits a cheap half (discount) from an expensive half (premium).`, at: Math.max(0, t.signal - 10), show: ["setup"] },
      {
        title: `Score: ${f.score} for the ${buy ? "buy" : "sell"} side`,
        text: `Every finished 5-minute candle adds up the ICT signals for each side. This one scores ${f.score} for ${buy ? "buying" : "selling"}, at least ${f.min_conf} and more than the other side, so it trades.`,
        at: t.signal,
        show: ["setup", "signal"],
        checks: parts.map((p) => ({ label: p.label, value: `${p.pts} pt${p.pts === 1 ? "" : "s"} · ${p.note}`, ok: p.pts > 0 })),
      },
      orderStep(d, `Entry: the 5-minute close, live for 5 minutes. Stop: past the order block or last swing. Target: ${f.rr} × the stop. Size: risk $${f.risk_usd} gives ${f.qty} contract${f.qty === 1 ? "" : "s"}.`),
      fillStep(d, `Rules from the source take over: stop to entry at ${f.be_r}R, part profit at 1R, losers closed after ${f.timeout_min / 60} hours.`),
      manageStep(d, `Once the trade gains ${f.be_r}R, the stop moves to just past the entry, then trails.`),
      exitStep(d),
    ];
    return steps.filter(Boolean) as Step[];
  },
};

export const stepsFor = (d: Demo): Step[] => BUILD[d.id]?.(d) ?? [];
