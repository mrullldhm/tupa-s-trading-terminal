import { createChart, CandlestickSeries, LineSeries, LineType, ColorType, createSeriesMarkers, type UTCTimestamp } from "lightweight-charts";
import { usd } from "./format";
import { malaysiaTimestamp, malaysiaTick } from "./time";
import type { TradeReplay } from "./trade-replay";

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
}
const clock = malaysiaTimestamp;
const chartTitle = (label: string) => label
  .replace("Confirmed 1m swing ", "1m ").replace("Confirmed swing ", "Swing ")
  .replace("Anchor body ", "Anchor ").replace("Entry bias (+1 long / -1 short)", "Bias")
  .replace(" (+1 up / -1 down)", "").replace(" (previous bar, dollars)", "")
  .replace(" (dollars)", "");

export function renderReplay(root: HTMLElement, replay: TradeReplay): () => void {
  const note = node("p", "Real historical CL prices · Backtest fills, not live executions · Malaysia time (MYT, UTC+8) · In-sample", "replay-note");
  root.append(note);
  const legend = node("div", "", "replay-legend");
  for (const line of replay.lines) {
    const item = node("span"); const swatch = node("i"); swatch.style.setProperty("--legend-color", line.color);
    item.append(swatch, document.createTextNode(line.label)); legend.append(item);
  }
  root.append(legend);
  const canvas = node("div", "", "replay-canvas");
  const panes = Math.max(0, ...replay.lines.map(line => line.pane ?? 0));
  canvas.style.height = `${320 + panes * 80}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Actual one-minute CL candles with strategy indicators and trade fills on ${replay.day}. Execution prices are listed below.`);
  root.append(canvas);
  const chart = createChart(canvas, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: "#0c0c0d" }, textColor: "rgba(249,249,249,0.66)",
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono").trim(), fontSize: 11 },
    grid: { vertLines: { color: "rgba(255,255,255,0.035)" }, horzLines: { color: "rgba(255,255,255,0.05)" } },
    rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
    timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.12)",
      tickMarkFormatter: (time: unknown, type: number) => malaysiaTick(Number(time), type) },
    localization: { locale: "en-US", timeFormatter: (time: unknown) => clock(Number(time)) + " MYT" },
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
  });
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: "#0c0c0d", downColor: "#8b8b91", borderUpColor: "#f2f2f2", borderDownColor: "#8b8b91",
    wickUpColor: "#f2f2f2", wickDownColor: "#8b8b91", priceLineVisible: false,
    priceFormat: { type: "price", precision: 2, minMove: 0.01 },
  });
  candles.setData(replay.candles.map(c => ({ ...c, time: c.time as UTCTimestamp })));
  for (const line of replay.lines) {
    const series = chart.addSeries(LineSeries, { color: line.color, lineWidth: 1, lineType: LineType.WithSteps,
      title: chartTitle(line.label), priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, line.pane ?? 0);
    series.setData(line.points.map(p => p.value !== null && Number.isFinite(p.value)
      ? { time: p.time as UTCTimestamp, value: p.value } : { time: p.time as UTCTimestamp }));
  }
  createSeriesMarkers(candles, replay.trades.flatMap((trade, i) => [
    { time: trade.entry_time as UTCTimestamp, position: trade.side === "Long" ? "belowBar" as const : "aboveBar" as const,
      shape: trade.side === "Long" ? "arrowUp" as const : "arrowDown" as const, color: "#f9f9f9", text: `${i + 1} ${trade.side} ${trade.entry_price.toFixed(2)}` },
    { time: trade.exit_time as UTCTimestamp, position: trade.side === "Long" ? "aboveBar" as const : "belowBar" as const,
      shape: "circle" as const, color: trade.profit >= 0 ? "#8fd4c1" : "#e7a39d", text: `${i + 1} Exit ${trade.exit_price.toFixed(2)}` },
  ]).sort((a, b) => Number(a.time) - Number(b.time)));
  chart.timeScale().fitContent();
  for (let i = 1; i < chart.panes().length; i++) chart.panes()[i].setHeight(80);
  let width = canvas.clientWidth;
  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth !== width) { width = canvas.clientWidth; requestAnimationFrame(() => { if (canvas.isConnected) chart.timeScale().fitContent(); }); }
  });
  resize.observe(canvas);
  const wrap = node("div", "", "table-scroll");
  const table = node("table", "", "data replay-trades");
  const caption = node("caption", "Execution fills, commission included", "sr-only");
  const head = node("thead"); const header = node("tr");
  for (const [i, text] of ["Trade", "Entry (MYT)", "Entry price", "Exit (MYT)", "Exit price", "Reason", "Net profit"].entries()) {
    const th = node("th", text, [2, 4, 6].includes(i) ? "num" : ""); th.scope = "col"; header.append(th);
  }
  head.append(header); const body = node("tbody");
  replay.trades.forEach((trade, i) => {
    const row = node("tr");
    const label = node("th", `${i + 1} ${trade.side}`); label.scope = "row"; row.append(label);
    for (const [text, className] of [
      [clock(trade.entry_time), "mono execution-time"], [trade.entry_price.toFixed(2), "num execution-price"],
      [clock(trade.exit_time), "mono execution-time"], [trade.exit_price.toFixed(2), "num execution-price"],
      [trade.exit_reason, ""], [usd(trade.profit), "num execution-price"],
    ]) {
      row.append(node("td", text, className));
    }
    body.append(row);
  });
  table.append(caption, head, body); wrap.append(table); root.append(wrap);
  const details = node("details"); details.append(node("summary", "Strategy settings and replay notes"));
  details.append(node("p", Object.entries(replay.params).map(([key, value]) => `${key}: ${String(value)}`).join(" · "), "replay-note"));
  if (replay.filters.length) details.append(node("p", `Entry filters: ${JSON.stringify(replay.filters)}`, "replay-note"));
  for (const text of replay.notes) details.append(node("p", text, "replay-note"));
  root.append(details);
  const values = node("details"); values.append(node("summary", "Show candle and indicator values"));
  let filled = false;
  values.addEventListener("toggle", () => {
    if (!values.open || filled) return;
    filled = true;
    const well = node("div", "", "table-scroll");
    const numbers = node("table", "", "data replay-trades");
    numbers.append(node("caption", "Real candle prices and strategy indicator values at each one-minute bar (MYT, UTC+8)", "sr-only"));
    const head = node("thead"); const headings = node("tr");
    for (const label of ["Time (MYT)", "Open", "High", "Low", "Close", ...replay.lines.map(line => line.label)]) {
      const th = node("th", label); th.scope = "col"; headings.append(th);
    }
    head.append(headings); const body = node("tbody");
    const columns = replay.lines.map(line => new Map(line.points.map(p => [p.time, p.value])));
    for (const candle of replay.candles) {
      const row = node("tr"); const time = node("th", clock(candle.time), "mono"); time.scope = "row"; row.append(time);
      for (const value of [candle.open, candle.high, candle.low, candle.close, ...columns.map(col => col.get(candle.time))]) {
        row.append(node("td", value == null ? "–" : String(Number(value.toFixed(6))), "num"));
      }
      body.append(row);
    }
    numbers.append(head, body); well.append(numbers); values.append(well);
  });
  root.append(values);
  return () => { resize.disconnect(); chart.remove(); };
}
