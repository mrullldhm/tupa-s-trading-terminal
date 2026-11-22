import {
  CandlestickSeries, ColorType, CrosshairMode, LineSeries, LineType, TickMarkType,
  createChart, type CandlestickData, type ISeriesApi, type Logical, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { marketClock, marketDate, type ChartIndicator, type HistoricalChart, type SwingZigzag } from "../data/setup-chart";

const up = "#22ab94";
const down = "#f23645";
const ink = "#c1c7d4";
const marketDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short",
});

function setupFullscreen(frame: HTMLElement, toggle: HTMLButtonElement) {
  const inertSiblings: HTMLElement[] = [];
  const sync = () => {
    const open = document.fullscreenElement === frame || frame.hasAttribute("data-expanded");
    const wasOpen = toggle.getAttribute("aria-pressed") === "true";
    toggle.setAttribute("aria-pressed", String(open));
    toggle.title = open ? "Exit fullscreen" : "Enter fullscreen";
    if (wasOpen && !open) toggle.focus({ preventScroll: true });
  };
  const expand = (open: boolean) => {
    frame.toggleAttribute("data-expanded", open);
    document.documentElement.classList.toggle("chart-viewport-expanded", open);
    if (open) {
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.setAttribute("aria-label", "Fullscreen setup chart");
      for (let node: HTMLElement = frame; node !== document.body && node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling instanceof HTMLElement && sibling !== node && !sibling.inert) {
            sibling.inert = true;
            inertSiblings.push(sibling);
          }
        }
      }
      toggle.focus({ preventScroll: true });
    } else {
      for (const sibling of inertSiblings.splice(0)) sibling.inert = false;
      for (const name of ["role", "aria-modal", "aria-label"]) frame.removeAttribute(name);
    }
    sync();
  };
  document.addEventListener("fullscreenchange", sync);
  frame.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && frame.hasAttribute("data-expanded")) {
      event.preventDefault();
      expand(false);
    }
  });
  toggle.addEventListener("click", async () => {
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen();
    } else if (frame.hasAttribute("data-expanded")) {
      expand(false);
    } else if (document.fullscreenEnabled && frame.requestFullscreen) {
      try {
        await frame.requestFullscreen();
      } catch {
        expand(true);
      }
    } else {
      expand(true);
    }
  });
}

const chartRoots = document.querySelectorAll<HTMLElement>("[data-setup-chart]");
for (const [chartIndex, root] of chartRoots.entries()) {
  const data = JSON.parse(root.dataset.setupChart!) as HistoricalChart;
  const trade = "trade" in data ? data.trade : null;
  const reaction = "reaction" in data ? data.reaction : null;
  const pattern = "pattern" in data ? data.pattern : null;
  const setupStart = trade?.signalOpen ?? pattern!.candle1;
  const confirmationBar = pattern && (pattern.confirmationBar ?? (
    pattern.confirmationMethod === "swing-close" ? pattern.confirmed - 60 : pattern.confirmed
  ));
  const setupEnd = trade?.exitTime ?? confirmationBar!;
  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const plot = q("[data-chart-plot]");
  let activeTf = "";
  const dateTime = (ts: Time) => {
    const ms = Number(ts) * 1000;
    const day = marketDate.format(ms);
    return activeTf === "1d" ? day : day + " " + marketClock.format(ms);
  };
  for (const selector of ["[data-chart-plot]", "[data-chart-tools]", "[data-chart-readout]", "[data-chart-caption]"]) {
    q(selector).hidden = false;
  }
  const chart = createChart(plot, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "#0b0c0f" },
      textColor: ink,
      fontFamily: "Geist Variable, system-ui, sans-serif",
      attributionLogo: chartIndex === 0,
    },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { borderColor: "#30343e", scaleMargins: { top: 0.1, bottom: 0.12 } },
    timeScale: {
      borderColor: "#30343e", timeVisible: true, secondsVisible: false,
      minBarSpacing: 0.1, fixRightEdge: true, lockVisibleTimeRangeOnResize: true,
      tickMarkFormatter: (ts: Time, type: TickMarkType) => {
        const ms = Number(ts) * 1000;
        return activeTf === "1d" || type < TickMarkType.Time ? marketDay.format(ms) : marketClock.format(ms);
      },
    },
    localization: { timeFormatter: dateTime },
    crosshair: { mode: CrosshairMode.Normal },
    handleScroll: { vertTouchDrag: false },
  });
  const series = chart.addSeries(CandlestickSeries, {
    upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false,
    lastValueVisible: false, priceLineVisible: false,
  });
  const timeScale = chart.timeScale();
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-tf]")];
  const prices = (["open", "high", "low", "close"] as const).map((key) => ({ key, el: q(`[data-price="${key}"]`) }));
  const candleTime = q("[data-candle-time]");
  const candleVolume = q("[data-volume]");
  const candleAnnouncement = q("[data-candle-announcement]");
  const number = new Intl.NumberFormat("en-US");
  const indicatorChecks = [...root.querySelectorAll<HTMLInputElement>("[data-indicator]")];
  const indicatorAll = root.querySelector<HTMLButtonElement>("[data-indicator-all]");
  const retrospectiveLabel = root.querySelector<HTMLElement>("[data-retrospective-label]");
  const positionButton = root.querySelector<HTMLButtonElement>("[data-position]");
  const hiddenIndicators = new Set(indicatorChecks.filter((input) => !input.checked).map((input) => input.dataset.indicator!));
  let positionVisible = true;
  let redraw = () => {};
  let indicatorSeries: ISeriesApi<"Line", Time>[] = [];
  let indicators: ChartIndicator[] = [];
  let zigzags: { name: string; color: string; dashed: boolean; pivots: { time: number; price: number; index: number }[] }[] = [];
  let bars: CandlestickData<Time>[] = [];
  let volumes: number[] = [];
  let ends: number[] = [];
  let indexByTime = new Map<Time, number>();
  let cursor = 0;
  const barIndex = (seconds: number) => {
    const next = bars.findIndex((bar) => Number(bar.time) > seconds);
    return next < 0 ? bars.length - 1 : Math.max(0, next - 1);
  };
  const inspect = (index: number) => {
    const bar = bars[index];
    if (!bar) return;
    cursor = index;
    candleTime.textContent = dateTime(bar.time);
    for (const { key, el } of prices) el.textContent = bar[key].toFixed(2);
    candleVolume.textContent = number.format(volumes[index]);
  };
  const announceCandle = () => {
    const bar = bars[cursor];
    if (!bar) return;
    candleAnnouncement.textContent = `${dateTime(bar.time)}. Open ${bar.open.toFixed(2)}, high ${bar.high.toFixed(2)}, `
      + `low ${bar.low.toFixed(2)}, close ${bar.close.toFixed(2)} US dollars per barrel. Volume ${number.format(volumes[cursor])}.`;
  };

  // Interpolate so the setup window and fills retain their times inside larger candles.
  const timeX = (seconds: number, index = barIndex(seconds)) => {
    const bar = bars[index];
    if (!bar) return null;
    const center = timeScale.logicalToCoordinate(index as Logical);
    const next = timeScale.logicalToCoordinate((index + 1) as Logical);
    if (center == null || next == null) return null;
    const spacing = next - center;
    const elapsed = (seconds - Number(bar.time)) / (ends[index] - Number(bar.time));
    const fraction = Math.max(0, Math.min(1, elapsed));
    return center + spacing * (fraction - 0.5);
  };
  series.attachPrimitive({
    attached({ requestUpdate }) { redraw = requestUpdate; },
    autoscaleInfo(start, end) {
      if (!trade || !positionVisible || !bars.length || end < barIndex(trade.fillTime) || start > barIndex(trade.exitTime)) return null;
      const values = [trade.entry, trade.stop, trade.target ?? trade.entry, trade.exit];
      return { priceRange: { minValue: Math.min(...values), maxValue: Math.max(...values) } };
    },
    paneViews: () => [{
      renderer: () => ({
        drawBackground(target) {
          const band = hiddenIndicators.has("Reaction band") ? null : reaction;
          const top = band ? series.priceToCoordinate(band.bandHigh) : null;
          const bottom = band ? series.priceToCoordinate(band.bandLow) : null;
          const signalStart = trade?.signalOpen ?? pattern!.catalyst;
          const signalEnd = trade?.signalTime ?? pattern!.catalystEnd;
          const left = timeX(signalStart);
          const right = trade ? timeX(signalEnd) : timeX(signalEnd, barIndex(signalEnd - 1));
          const fill = trade && timeX(trade.fillTime);
          const exit = trade && timeX(trade.exitTime);
          const entryY = trade && series.priceToCoordinate(trade.entry);
          const stopY = trade && series.priceToCoordinate(trade.stop);
          const targetY = trade?.target == null ? null : series.priceToCoordinate(trade.target);
          target.useMediaCoordinateSpace(({ context, mediaSize }) => {
            if (left != null && right != null) {
              context.fillStyle = "rgba(91, 140, 255, 0.11)";
              context.fillRect(left, 0, right - left, mediaSize.height);
            }
            if (top != null && bottom != null) {
              context.fillStyle = "rgba(42, 161, 179, 0.18)";
              context.fillRect(0, top, mediaSize.width, bottom - top);
              context.fillStyle = "rgba(70, 190, 211, 0.52)";
              context.fillRect(0, top, mediaSize.width, 1);
              context.fillRect(0, bottom, mediaSize.width, 1);
            }
            if (!trade || !positionVisible || fill == null || exit == null || entryY == null || stopY == null) return;
            const width = Math.max(4, exit - fill);
            context.fillStyle = "rgba(240, 97, 109, 0.24)";
            context.fillRect(fill, Math.min(entryY, stopY), width, Math.abs(entryY - stopY));
            if (targetY != null) {
              context.fillStyle = "rgba(52, 195, 143, 0.23)";
              context.fillRect(fill, Math.min(entryY, targetY), width, Math.abs(entryY - targetY));
            }
          });
        },
        draw(target) {
          for (let i = zigzags.length - 1; i >= 0; i--) {
            const { name, color, dashed, pivots } = zigzags[i];
            if (hiddenIndicators.has(name)) continue;
            const points = pivots.flatMap(({ time, price, index }, i) => {
              const sharedCandle = pivots[i - 1]?.index === index || pivots[i + 1]?.index === index;
              const x = sharedCandle ? timeX(time + 30, index) : timeScale.logicalToCoordinate(index as Logical);
              const y = series.priceToCoordinate(price);
              return x == null || y == null ? [] : [{ x, y }];
            });
            target.useMediaCoordinateSpace(({ context }) => {
              context.save();
              context.strokeStyle = color;
              context.fillStyle = color;
              context.lineWidth = 1.5;
              context.lineJoin = "round";
              context.lineCap = "round";
              if (dashed) context.setLineDash([5, 4]);
              context.beginPath();
              for (const [i, { x, y }] of points.entries()) {
                if (i === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
              }
              context.stroke();
              for (const { x, y } of points) {
                context.beginPath();
                context.arc(x, y, 2.25, 0, 2 * Math.PI);
                context.fill();
              }
              context.restore();
            });
          }
          if (pattern) {
            target.useMediaCoordinateSpace(({ context, mediaSize }) => {
              const level = series.priceToCoordinate(pattern.level);
              const retest = timeX(pattern.retest + 30);
              if (level != null && retest != null) {
                context.save();
                context.strokeStyle = "#9db8ff";
                context.fillStyle = "#9db8ff";
                context.setLineDash([4, 4]);
                context.beginPath();
                context.moveTo(timeX(pattern.catalyst) ?? 0, level);
                context.lineTo(retest, level);
                context.stroke();
                context.beginPath();
                context.arc(retest, level, 4, 0, 2 * Math.PI);
                context.fill();
                context.restore();
              }
              if (pattern.confirmationPrice != null && confirmationBar != null) {
                const x = timeX(confirmationBar + 30);
                const y = series.priceToCoordinate(pattern.confirmationPrice);
                if (x != null && y != null) {
                  context.save();
                  context.strokeStyle = "#9db8ff";
                  context.lineWidth = 1.5;
                  context.beginPath();
                  context.moveTo(x, y - 5);
                  context.lineTo(x + 5, y);
                  context.lineTo(x, y + 5);
                  context.lineTo(x - 5, y);
                  context.closePath();
                  context.stroke();
                  context.restore();
                }
              }
              if (activeTf !== data.signalTf) return;
              context.fillStyle = ink;
              context.font = "12px Geist Variable, system-ui, sans-serif";
              context.textAlign = "center";
              for (const [number, time] of [pattern.candle1, pattern.candle2, pattern.candle3].entries()) {
                const index = barIndex(time);
                const bar = bars[index];
                const x = timeScale.logicalToCoordinate(index as Logical);
                const y = bar && series.priceToCoordinate(pattern.side === 1 ? bar.low : bar.high);
                if (x != null && y != null && x >= 0 && x <= mediaSize.width) {
                  context.fillText(`C${number + 1}`, x, y + (pattern.side === 1 ? 16 : -10));
                }
              }
            });
          }
          if (!trade || !positionVisible) return;
          const fillX = timeX(trade.fillTime);
          const fillY = series.priceToCoordinate(trade.entry);
          const exitX = timeX(trade.exitTime);
          const exitY = series.priceToCoordinate(trade.exit);
          const partialX = trade.partial ? timeX(trade.partial.time) : null;
          const partialY = trade.partial ? series.priceToCoordinate(trade.partial.price) : null;
          target.useMediaCoordinateSpace(({ context }) => {
            if (fillX != null && fillY != null) {
              context.beginPath();
              context.arc(fillX, fillY, 5, 0, 2 * Math.PI);
              context.fillStyle = "#83aaff";
              context.fill();
            }
            if (exitX != null && exitY != null) {
              context.fillStyle = "#e7ebf5";
              context.fillRect(exitX - 4, exitY - 4, 8, 8);
            }
            if (partialX != null && partialY != null) {
              context.strokeStyle = "#e7ebf5";
              context.strokeRect(partialX - 3, partialY - 3, 6, 6);
            }
          });
        },
      }),
    }],
  });

  const showIndicators = () => {
    const range = timeScale.getVisibleLogicalRange();
    for (const line of indicatorSeries) chart.removeSeries(line);
    const panes = new Map([["Price", 0]]);
    indicatorSeries = indicators.filter((indicator) => !hiddenIndicators.has(indicator.name)).map((indicator) => {
      if (!panes.has(indicator.pane)) panes.set(indicator.pane, panes.size);
      const line = chart.addSeries(LineSeries, {
        title: indicator.name,
        color: indicator.color,
        lineType: indicator.stepped ? LineType.WithSteps : LineType.Simple,
        lineWidth: 1,
        pointMarkersVisible: activeTf === "1d",
        priceLineVisible: false,
        lastValueVisible: false,
      }, panes.get(indicator.pane));
      line.setData(bars.map((bar, i) => {
        const value = indicator.values[i];
        return value == null ? { time: bar.time } : { time: bar.time, value };
      }));
      return line;
    });
    if (panes.size > 1) chart.panes()[0].setStretchFactor(3);
    plot.toggleAttribute("data-indicator-panes", panes.size > 1);
    if (retrospectiveLabel) retrospectiveLabel.hidden = !zigzags.some(({ dashed, name }) => dashed && !hiddenIndicators.has(name));
    if (range) timeScale.setVisibleLogicalRange(range);
    redraw();
  };

  const fitSetup = () => {
    const start = barIndex(setupStart);
    const end = barIndex(setupEnd);
    if (pattern) {
      const padding = Math.max(plot.clientWidth < 500 ? 3 : 6, Math.ceil((end - start) / 8));
      chart.priceScale("right").applyOptions({ autoScale: true });
      timeScale.setVisibleLogicalRange({ from: Math.max(0, start - padding), to: Math.min(bars.length - 1, end + padding) });
      return;
    }
    const padding = Math.max(5, Math.ceil((end - start) / 8));
    let from = Math.max(0, start - padding);
    let to = Math.min(bars.length, end + padding);
    const pivots = zigzags.find((zigzag) => zigzag.pivots.length > 1 && !hiddenIndicators.has(zigzag.name))?.pivots;
    if (pivots) {
      if (pivots.at(-1)!.index < from) from = Math.max(0, pivots.at(-2)!.index - 2);
      if (pivots[0].index > to) to = Math.min(bars.length, pivots[1].index + 2);
    }
    const count = 2 * (Math.min(to, bars.length - 1) - from + 1);
    to = Math.min(bars.length - 1, from + count - 1);
    from = Math.max(0, to - count + 1);
    chart.priceScale("right").applyOptions({ autoScale: true });
    timeScale.setVisibleLogicalRange({ from, to });
  };
  const select = (tf: string) => {
    const view = data.views.find((v) => v.tf === tf);
    if (!view || activeTf === tf) return;
    activeTf = tf;
    chart.clearCrosshairPosition();
    timeScale.applyOptions({ timeVisible: tf !== "1d" });
    bars = view.candles.map(([time, open, high, low, close]) => ({ time: time as UTCTimestamp, open, high, low, close }));
    volumes = view.candles.map((bar) => bar[5]);
    ends = view.candles.map((bar) => bar[6]);
    indicators = view.indicators;
    const indexZigzag = ({ name, color, points }: SwingZigzag, dashed: boolean) => ({
      name, color, dashed, pivots: points.map(([time, price]) => ({ time, price, index: barIndex(time) })),
    });
    zigzags = view.swing ? [indexZigzag(view.swing, false)] : [];
    if (view.retrospectiveSwing) zigzags.push(indexZigzag(view.retrospectiveSwing, true));
    indexByTime = new Map(bars.map((bar, i) => [bar.time, i]));
    series.setData(bars);
    showIndicators();
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.tf === tf));
    fitSetup();
    inspect(barIndex(trade ? trade.signalTime - 1 : pattern!.retest));
  };

  const zoom = (factor: number) => {
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const midpoint = (range.from + range.to) / 2;
    const width = Math.max(5, Math.min(bars.length, (range.to - range.from) * factor));
    timeScale.setVisibleLogicalRange({ from: midpoint - width / 2, to: midpoint + width / 2 });
  };
  for (const button of buttons) button.addEventListener("click", () => select(button.dataset.tf!));
  const updateIndicators = () => {
    hiddenIndicators.clear();
    for (const input of indicatorChecks) if (!input.checked) hiddenIndicators.add(input.dataset.indicator!);
    if (indicatorAll) indicatorAll.textContent = indicatorChecks.every((input) => !input.checked) ? "Show all" : "Hide all";
    showIndicators();
  };
  for (const input of indicatorChecks) input.addEventListener("change", updateIndicators);
  indicatorAll?.addEventListener("click", () => {
    const show = indicatorChecks.every((input) => !input.checked);
    for (const input of indicatorChecks) input.checked = show;
    updateIndicators();
  });
  positionButton?.addEventListener("click", () => {
    positionVisible = !positionVisible;
    positionButton.setAttribute("aria-pressed", String(positionVisible));
    redraw();
  });
  q("[data-fit]").addEventListener("click", fitSetup);
  q('[data-zoom="in"]').addEventListener("click", () => zoom(0.75));
  q('[data-zoom="out"]').addEventListener("click", () => zoom(1.33));
  setupFullscreen(q("[data-chart-frame]"), q<HTMLButtonElement>("[data-fullscreen]"));
  chart.subscribeCrosshairMove(({ time }) => {
    const index = time == null ? undefined : indexByTime.get(time);
    if (index != null) inspect(index);
  });
  plot.addEventListener("focus", announceCandle);
  plot.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "Home") {
      event.preventDefault();
      if (event.key === "Home") fitSetup();
      else zoom(event.key === "-" ? 1.33 : 0.75);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = Math.max(0, Math.min(bars.length - 1, cursor + (event.key === "ArrowLeft" ? -1 : 1)));
    const range = timeScale.getVisibleLogicalRange();
    if (range && (next < range.from || next > range.to)) {
      const width = range.to - range.from;
      const from = next < range.from ? next : next - width;
      timeScale.setVisibleLogicalRange({ from, to: from + width });
    }
    inspect(next);
    chart.setCrosshairPosition(bars[next].close, bars[next].time, series);
    announceCandle();
  });
  select(data.signalTf);
}
