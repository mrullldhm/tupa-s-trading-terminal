// Crosshair + readout for EquityChart. Reads the chart's data-equity payload; no inline script (CSP).
type Payload = {
  months: string[];
  series: { name: string; color: string; dash: boolean; ys: number[] }[];
  box: { W: number; PL: number; PR: number };
};

const fmt = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US")}`;
const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function el(tag: string, style: string, text?: string) {
  const e = document.createElement(tag);
  e.setAttribute("style", style);
  if (text != null) e.textContent = text;
  return e;
}

for (const fig of document.querySelectorAll<HTMLElement>("[data-equity]")) {
  const data = JSON.parse(fig.dataset.equity!) as Payload;
  const plot = fig.querySelector<HTMLElement>(".eq-plot")!;
  const tip = fig.querySelector<HTMLElement>(".tip")!;
  const cross = fig.querySelector<SVGLineElement>(".cross")!;
  const { W, PL, PR } = data.box;
  const n = data.months.length;

  const show = (clientX: number) => {
    const r = plot.getBoundingClientRect();
    const fx = ((clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((fx - PL) / (W - PL - PR)) * (n - 1))));
    const sx = PL + (i / Math.max(1, n - 1)) * (W - PL - PR);
    cross.setAttribute("x1", String(sx));
    cross.setAttribute("x2", String(sx));
    tip.replaceChildren(el("div", "color:var(--ink-3);margin-bottom:.25rem", `${monthName(data.months[i])} · running total`));
    for (const s of [...data.series].sort((a, b) => b.ys[i] - a.ys[i])) {
      const row = el("div", "display:flex;gap:.8rem;align-items:center;justify-content:space-between");
      const name = el("span", "display:flex;gap:.4rem;align-items:center;color:var(--ink-2)");
      const fill = s.dash ? `repeating-linear-gradient(90deg,${s.color} 0 3px,transparent 3px 5px)` : s.color;
      name.append(el("i", `width:8px;height:8px;border-radius:2px;background:${fill}`), s.name);
      row.append(name, el("b", "font-weight:500;font-variant-numeric:tabular-nums", fmt(s.ys[i])));
      tip.append(row);
    }
    tip.hidden = false;
    const px = (sx / W) * r.width;
    const tw = tip.offsetWidth;
    tip.style.left = `${px + 14 + tw > r.width ? Math.max(0, px - tw - 14) : px + 14}px`;
    fig.classList.add("hover");
  };
  const hide = () => {
    tip.hidden = true;
    fig.classList.remove("hover");
  };
  // Legend buttons pick the highlighted line; its end label shows. Click again to show all lines equally.
  const lines = [...fig.querySelectorAll<SVGPathElement>(".line")];
  const ends = [...fig.querySelectorAll<HTMLElement>(".end")];
  const buttons = [...fig.querySelectorAll<HTMLButtonElement>(".lg")];
  const focus = (i: number | null) => {
    if (i == null) delete fig.dataset.focus;
    else fig.dataset.focus = String(i);
    for (const el of [...lines, ...ends]) el.classList.toggle("on", Number(el.dataset.i) === i);
    for (const b of buttons) b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i));
    // Panels for one version (data-vpanel = its line index) follow the highlighted line; none chosen: the best (0).
    if (fig.dataset.panels != null)
      for (const p of document.querySelectorAll<HTMLElement>("[data-vpanel]")) p.hidden = Number(p.dataset.vpanel) !== (i ?? 0);
  };
  if (fig.dataset.focus != null) focus(Number(fig.dataset.focus));
  for (const b of buttons) {
    b.addEventListener("click", () => focus(b.getAttribute("aria-pressed") === "true" ? null : Number(b.dataset.i)));
  }

  plot.addEventListener("pointermove", (e) => show(e.clientX));
  plot.addEventListener("pointerdown", (e) => show(e.clientX));
  plot.addEventListener("pointerleave", hide);
}
