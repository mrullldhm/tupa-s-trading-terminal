// Chart rendering with TradingView Lightweight Charts. Loaded on demand by charts.client.ts. Data arrives as JSON in
// data attributes.
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Step } from "./illustrative";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`chart markup is missing ${selector}`);
  return el;
}

function jsonData<T>(el: HTMLElement, key: string): T {
  const raw = el.dataset[key];
  if (raw === undefined) throw new Error(`chart markup is missing data-${key}`);
  return JSON.parse(raw) as T;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function base(el: HTMLElement, opts: { time: boolean; minutes?: boolean }): IChartApi {
  const pad = (n: number) => String(n).padStart(2, "0");
  return createChart(el, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "rgba(249,249,249,0.55)",
      fontFamily: css("--mono"),
      fontSize: 11,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: "rgba(255,255,255,0.035)" },
      horzLines: { color: "rgba(255,255,255,0.05)" },
    },
    rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
    timeScale: {
      borderColor: "rgba(255,255,255,0.08)",
      timeVisible: opts.time,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: opts.minutes
        ? (t: number) => {
            const d = new Date(t * 1000);
            return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
          }
        : undefined,
    },
    localization: opts.minutes
      ? {
          timeFormatter: (t: number) => {
            const d = new Date(t * 1000);
            return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} NY`;
          },
        }
      : { locale: "en-US" },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#1f1f23" },
      horzLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#1f1f23" },
    },
    handleScroll: false,
    handleScale: false,
  });
}

const TONE: Record<Step["lines"][number]["tone"], string> = {
  ink: "rgba(249,249,249,0.85)",
  dim: "rgba(249,249,249,0.35)",
  long: "#8fd4c1",
  short: "#e7a39d",
};

export function annotated(root: HTMLElement) {
  const candles = jsonData<Candle[]>(root, "candles");
  const steps = jsonData<Step[]>(root, "steps");
  const el = required<HTMLElement>(root, "[data-canvas]");
  const chart = base(el, { time: true, minutes: true });
  const series = chart.addSeries(CandlestickSeries, {
    upColor: "#0c0c0d",
    downColor: "#8b8b91",
    borderUpColor: "#f2f2f2",
    borderDownColor: "#8b8b91",
    wickUpColor: "#f2f2f2",
    wickDownColor: "#8b8b91",
    priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    lastValueVisible: false,
    priceLineVisible: false,
  });
  const markers = createSeriesMarkers(series, []);
  let lines: IPriceLine[] = [];
  const title = required<HTMLElement>(root, "[data-title]");
  const text = required<HTMLElement>(root, "[data-text]");
  const count = required<HTMLElement>(root, "[data-count]");
  const prev = required<HTMLButtonElement>(root, "[data-prev]");
  const next = required<HTMLButtonElement>(root, "[data-next]");
  const dots = [...root.querySelectorAll<HTMLButtonElement>("[data-dot]")];
  let at = 0;

  // The full series is always set so the price range stays fixed; future candles are drawn transparent.
  function show(i: number) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[at];
    series.setData(
      candles.map((c, k) =>
        k < s.until
          ? { ...c, time: c.time as UTCTimestamp }
          : { ...c, time: c.time as UTCTimestamp, color: "rgba(0,0,0,0)", borderColor: "rgba(255,255,255,0.025)", wickColor: "rgba(0,0,0,0)" },
      ),
    );
    markers.setMarkers(
      s.markers.map((mk) => ({
        time: candles[mk.index].time as UTCTimestamp,
        position: mk.position,
        shape: mk.shape,
        color: "#f9f9f9",
        text: mk.text,
      })),
    );
    lines.forEach((l) => series.removePriceLine(l));
    lines = s.lines.map((l) =>
      series.createPriceLine({
        price: l.price,
        color: TONE[l.tone],
        lineWidth: 1,
        lineStyle: l.tone === "dim" ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true,
        title: l.label,
      }),
    );
    title.textContent = s.title;
    text.textContent = s.text;
    count.textContent = `Step ${at + 1} of ${steps.length}`;
    prev.disabled = at === 0;
    next.disabled = at === steps.length - 1;
    dots.forEach((d, k) => d.setAttribute("aria-current", k === at ? "step" : "false"));
  }

  prev.addEventListener("click", () => show(at - 1));
  next.addEventListener("click", () => show(at + 1));
  dots.forEach((d, k) => d.addEventListener("click", () => show(k)));
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(at + 1);
    if (e.key === "ArrowLeft") show(at - 1);
  });
  show(0);
  chart.timeScale().fitContent();
}

type CurveSeries = { label: string; tone: "ink" | "dim" | "faint" | "long"; points: [string, number][] };

export function curves(root: HTMLElement) {
  const sets = jsonData<CurveSeries[]>(root, "series");
  const el = required<HTMLElement>(root, "[data-canvas]");
  const chart = base(el, { time: false });
  const color = { ink: "#f9f9f9", dim: "rgba(249,249,249,0.5)", faint: "rgba(249,249,249,0.26)", long: "#8fd4c1" };
  const width = { ink: 2, dim: 1, faint: 1, long: 2 } as const;
  let first: ISeriesApi<"Line"> | null = null;
  for (const s of sets) {
    const line = chart.addSeries(LineSeries, {
      color: color[s.tone],
      lineWidth: width[s.tone],
      lineStyle: s.tone === "faint" ? LineStyle.Dashed : LineStyle.Solid,
      priceFormat: { type: "custom", formatter: (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}` },
      lastValueVisible: true,
      priceLineVisible: false,
      title: s.label,
      crosshairMarkerRadius: 3,
    });
    line.setData(s.points.map(([month, v]) => ({ time: `${month}-01`, value: v })));
    first ??= line;
  }
  first?.createPriceLine({ price: 0, color: "rgba(255,255,255,0.28)", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: "" });
  chart.timeScale().fitContent();
}

