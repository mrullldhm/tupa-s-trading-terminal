// Step-through replay, autoplay, indicator toggle and live legend for StrategyDemo. Reads the figure's data-demo
// payload (no inline script, CSP). Without this script every step and every chart layer is visible.
type Payload = {
  W: number;
  PL: number;
  PR: number;
  N: number;
  MT: number;
  PB: number;
  lo: number;
  hi: number;
  c: [number, number, number, number, string][];
  items: { v: (number | null)[]; dp: number }[];
  steps: { at: number; show: string[] }[];
};

const STEP_MS = 2600;

for (const fig of document.querySelectorAll<HTMLElement>("[data-demo]")) {
  const d = JSON.parse(fig.dataset.demo!) as Payload;
  const q = <T extends Element>(s: string) => fig.querySelector<T>(s)!;
  const plot = q<HTMLElement>(".plot");
  const curtain = q<HTMLElement>(".curtain");
  const cross = q<SVGLineElement>(".cross");
  const lastLine = q<SVGLineElement>(".lastline");
  const lastTag = q<HTMLElement>(".tag.last");
  const tradeTags = [...fig.querySelectorAll<HTMLElement>(".tag.ly")];
  const count = q<HTMLElement>(".count");
  const prev = q<HTMLButtonElement>('[data-go="-1"]');
  const next = q<HTMLButtonElement>('[data-go="1"]');
  const play = q<HTMLButtonElement>("[data-play]");
  const ind = q<HTMLButtonElement>("[data-ind]");
  const clock = q<HTMLElement>("[data-clock]");
  const ohlc = (["o", "h", "l", "c"] as const).map((k) => q<HTMLElement>(`[data-${k}]`));
  const chg = q<HTMLElement>("[data-chg]");
  const vals = [...fig.querySelectorAll<HTMLElement>("[data-li]")];
  const items = [...fig.querySelectorAll<HTMLLIElement>(".steps > li")];
  const layers = [...fig.querySelectorAll<Element>(".ly")];
  const slot = (d.W - d.PL - d.PR) / d.N;
  const y = (v: number) => d.MT + (1 - (v - d.lo) / (d.hi - d.lo)) * (d.PB - d.MT);
  let cur = 0;
  let at = d.N - 1;
  let timer: number | undefined;

  fig.classList.add("js");
  curtain.hidden = false;
  for (const b of [prev, next, count, play]) b.hidden = false;

  /** Legend, last-price line and clock show candle i. */
  const read = (i: number) => {
    const [o, h, l, c, when] = d.c[i];
    [o, h, l, c].forEach((v, k) => (ohlc[k].textContent = v.toFixed(2)));
    const p = i > 0 ? d.c[i - 1][3] : o;
    const ch = c - p;
    const s = ch >= 0 ? "+" : "−";
    chg.textContent = `${s}${Math.abs(ch).toFixed(2)} (${s}${Math.abs((ch / p) * 100).toFixed(2)}%)`;
    for (const e of vals) {
      const it = d.items[Number(e.dataset.li)];
      const v = it.v[i];
      e.textContent = v == null ? "–" : v.toFixed(it.dp);
    }
    clock.textContent = when;
  };
  const lastAt = (i: number) => {
    const [o, , , c] = d.c[i];
    const yy = String(y(c));
    lastLine.setAttribute("y1", yy);
    lastLine.setAttribute("y2", yy);
    lastTag.style.top = `${y(c)}px`;
    lastTag.textContent = c.toFixed(2);
    lastTag.classList.toggle("up", c >= o);
    lastTag.classList.toggle("dn", c < o);
    // the order's own tags win: hide the last-price tag where it would cover one of them
    const clash = tradeTags.some((g) => !g.classList.contains("off") && Math.abs(parseFloat(g.style.top) - y(c)) < 16);
    lastTag.style.visibility = clash ? "hidden" : "";
  };

  const go = (k: number, focus = false) => {
    cur = Math.max(0, Math.min(d.steps.length - 1, k));
    const s = d.steps[cur];
    at = Math.min(s.at, d.N - 1);
    const show = new Set(s.show);
    for (const e of layers) e.classList.toggle("off", !show.has((e as HTMLElement).dataset.ly ?? ""));
    curtain.style.left = `${((d.PL + (at + 1) * slot) / d.W) * 100}%`;
    curtain.style.opacity = at >= d.N - 1 ? "0" : "1";
    items.forEach((li, i) => {
      li.classList.toggle("on", i === cur);
      li.classList.toggle("done", i < cur);
      li.querySelector("button")!.setAttribute("aria-current", i === cur ? "step" : "false");
    });
    count.textContent = `${cur + 1} of ${d.steps.length}`;
    prev.disabled = cur === 0;
    next.disabled = cur === d.steps.length - 1;
    read(at);
    lastAt(at);
    if (focus) items[cur].querySelector("button")!.focus();
  };

  const stop = () => {
    window.clearInterval(timer);
    timer = undefined;
    play.classList.remove("playing");
    play.querySelector(".lbl")!.textContent = "Replay";
  };
  play.addEventListener("click", () => {
    if (timer != null) return stop();
    go(0);
    play.classList.add("playing");
    play.querySelector(".lbl")!.textContent = "Pause";
    timer = window.setInterval(() => (cur >= d.steps.length - 1 ? stop() : go(cur + 1)), STEP_MS);
  });
  ind.addEventListener("click", () => {
    const on = ind.getAttribute("aria-pressed") !== "true";
    ind.setAttribute("aria-pressed", String(on));
    fig.classList.toggle("no-ind", !on);
  });
  prev.addEventListener("click", () => { stop(); go(cur - 1); });
  next.addEventListener("click", () => { stop(); go(cur + 1); });
  items.forEach((li, i) => li.querySelector("button")!.addEventListener("click", () => { stop(); go(i); }));
  fig.addEventListener("keydown", (e) => {
    if (!(e.target instanceof HTMLButtonElement) || !e.target.closest(".steps")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); stop(); go(cur + 1, true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); stop(); go(cur - 1, true); }
  });
  go(0);

  // Hover: the legend reads the candle under the pointer, but never one the replay has not reached.
  const hover = (clientX: number) => {
    const r = plot.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * d.W;
    if (fx > d.W - d.PR) return leave();
    const i = Math.max(0, Math.min(at, Math.floor((fx - d.PL) / slot)));
    const sx = d.PL + (i + 0.5) * slot;
    cross.setAttribute("x1", String(sx));
    cross.setAttribute("x2", String(sx));
    fig.classList.add("hover");
    read(i);
  };
  const leave = () => {
    fig.classList.remove("hover");
    read(at);
  };
  plot.addEventListener("pointermove", (e) => hover(e.clientX));
  plot.addEventListener("pointerdown", (e) => hover(e.clientX));
  plot.addEventListener("pointerleave", leave);
}

export {};
