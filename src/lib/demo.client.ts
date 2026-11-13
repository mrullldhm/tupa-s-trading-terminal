// Step-through replay + hover readout for StrategyDemo. Reads the figure's data-demo payload (no inline script, CSP).
// Without this script every step and every chart layer is visible.
type Payload = {
  W: number;
  PL: number;
  PR: number;
  N: number;
  c: [number, number, number, number, string][];
  lines: { n: string; col: string; v: (number | null)[]; dp: number }[];
  steps: { at: number; show: string[] }[];
};

function el(tag: string, style: string, text?: string) {
  const e = document.createElement(tag);
  e.setAttribute("style", style);
  if (text != null) e.textContent = text;
  return e;
}

for (const fig of document.querySelectorAll<HTMLElement>("[data-demo]")) {
  const d = JSON.parse(fig.dataset.demo!) as Payload;
  const plot = fig.querySelector<HTMLElement>(".plot")!;
  const curtain = fig.querySelector<HTMLElement>(".curtain")!;
  const tip = fig.querySelector<HTMLElement>(".tip")!;
  const cross = fig.querySelector<SVGLineElement>(".cross")!;
  const count = fig.querySelector<HTMLElement>(".count")!;
  const prev = fig.querySelector<HTMLButtonElement>('[data-go="-1"]')!;
  const next = fig.querySelector<HTMLButtonElement>('[data-go="1"]')!;
  const items = [...fig.querySelectorAll<HTMLLIElement>(".steps > li")];
  const layers = [...fig.querySelectorAll<Element>(".ly")];
  const slot = (d.W - d.PL - d.PR) / d.N;
  const xr = (i: number) => d.PL + (i + 1) * slot;
  let cur = 0;
  let at = d.N - 1;

  fig.classList.add("js");
  curtain.hidden = false;
  for (const b of [prev, next, count]) b.hidden = false;

  const go = (k: number, focus = false) => {
    cur = Math.max(0, Math.min(d.steps.length - 1, k));
    const s = d.steps[cur];
    at = s.at;
    const show = new Set(s.show);
    for (const e of layers) e.classList.toggle("off", !show.has((e as HTMLElement).dataset.ly ?? ""));
    curtain.style.left = `${(xr(at) / d.W) * 100}%`;
    curtain.style.opacity = at >= d.N - 1 ? "0" : "1";
    items.forEach((li, i) => {
      li.classList.toggle("on", i === cur);
      li.classList.toggle("done", i < cur);
      li.querySelector("button")!.setAttribute("aria-current", i === cur ? "step" : "false");
    });
    count.textContent = `${cur + 1} of ${d.steps.length}`;
    prev.disabled = cur === 0;
    next.disabled = cur === d.steps.length - 1;
    if (focus) items[cur].querySelector("button")!.focus();
  };

  prev.addEventListener("click", () => go(cur - 1));
  next.addEventListener("click", () => go(cur + 1));
  items.forEach((li, i) => li.querySelector("button")!.addEventListener("click", () => go(i)));
  fig.addEventListener("keydown", (e) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(cur + 1, true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(cur - 1, true); }
  });
  go(0);

  // Hover readout: only candles the replay has reached, so the future stays hidden.
  const show = (clientX: number) => {
    const r = plot.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * d.W;
    const i = Math.max(0, Math.min(at, Math.floor((fx - d.PL) / slot)));
    const sx = d.PL + (i + 0.5) * slot;
    cross.setAttribute("x1", String(sx));
    cross.setAttribute("x2", String(sx));
    const [o, h, l, c, when] = d.c[i];
    tip.replaceChildren(el("div", "color:var(--ink-3);margin-bottom:.2rem", `${when} Chicago`));
    const ohlc = el("div", "display:grid;grid-template-columns:repeat(4,auto);gap:0 .7rem;font-variant-numeric:tabular-nums;margin-bottom:.25rem");
    for (const [k, v] of [["O", o], ["H", h], ["L", l], ["C", c]] as const) {
      const cell = el("span", "color:var(--ink-3)", `${k} `);
      cell.append(el("b", "font-weight:500;color:var(--ink)", v.toFixed(2)));
      ohlc.append(cell);
    }
    tip.append(ohlc);
    for (const ln of d.lines) {
      const v = ln.v[i];
      if (v == null) continue;
      const row = el("div", "display:flex;gap:.8rem;align-items:center;justify-content:space-between");
      const name = el("span", "display:flex;gap:.4rem;align-items:center;color:var(--ink-2)");
      name.append(el("i", `width:8px;height:2px;border-radius:2px;background:${ln.col}`), ln.n);
      row.append(name, el("b", "font-weight:500;font-variant-numeric:tabular-nums", v.toFixed(ln.dp)));
      tip.append(row);
    }
    tip.hidden = false;
    const px = (sx / d.W) * r.width;
    const tw = tip.offsetWidth;
    tip.style.left = `${px + 14 + tw > r.width ? Math.max(0, px - tw - 14) : px + 14}px`;
    fig.classList.add("hover");
  };
  const hide = () => {
    tip.hidden = true;
    fig.classList.remove("hover");
  };
  plot.addEventListener("pointermove", (e) => show(e.clientX));
  plot.addEventListener("pointerdown", (e) => show(e.clientX));
  plot.addEventListener("pointerleave", hide);
}

export {};
