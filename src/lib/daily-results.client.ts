import { usd, tone } from "./format";
import { SCENARIO_KEYS, isPeriodTable, periodFileUrl, type PeriodTable } from "./periods";
import type { TradeReplay } from "./trade-replay";

const PAGE_SIZE = 30;
// Share both the capability check and renderer download across result tables.
let capability: Promise<{ available?: boolean } | null> | undefined;
let renderer: Promise<typeof import("./trade-replay.render")> | undefined;
function loadRenderer() {
  return renderer ??= import("./trade-replay.render").catch(error => { renderer = undefined; throw error; });
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function bootDailyResults() {
  for (const root of document.querySelectorAll<HTMLElement>("[data-periods]")) {
    if (root.dataset.booted) continue;
    root.dataset.booted = "true";
    const { strategy = "", key = "", version, generated } = root.dataset;
    const panel = root.querySelector<HTMLElement>("[data-replay-panel]")!;
    const rows = root.querySelector<HTMLTableSectionElement>("[data-rows]")!;
    const more = root.querySelector<HTMLButtonElement>("[data-more]")!;
    const status = root.querySelector<HTMLElement>("[data-status]")!;
    const count = root.querySelector<HTMLElement>("[data-count]")!;
    let table: PeriodTable | undefined;
    let displayed = rows.children.length;
    let interactive = false;
    let active: { row: HTMLTableRowElement; detail: HTMLElement; destroy?: () => void; controller: AbortController } | undefined;

    const close = () => {
      if (!active) return;
      active.controller.abort();
      active.destroy?.();
      active.row.removeAttribute("data-open");
      active.row.querySelector("button")?.setAttribute("aria-expanded", "false");
      active.row.querySelector("button")?.removeAttribute("aria-controls");
      active.detail.replaceChildren();
      active.detail.hidden = true;
      active = undefined;
    };

    function wireRow(row: HTMLTableRowElement) {
      if (!interactive || row.dataset.interactive) return;
      row.dataset.interactive = "true";
      const label = row.querySelector("[data-day-label]")!;
      const button = el("button", "", "day-toggle");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      const detailId = `replay-${strategy}-${key}-${row.dataset.day}`;
      // Same stroke geometry as the site's disclosure arrows.
      button.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
      button.append(el("span", label.textContent ?? ""));
      label.replaceWith(button);
      row.addEventListener("click", event => {
        if (event.target instanceof Element && event.target.closest("button") && !button.contains(event.target)) return;
        if (active?.row === row) { close(); return; }
        close();
        const detail = panel;
        detail.id = detailId;
        detail.hidden = false;
        const cell = el("div", "", "replay-cell");
        detail.replaceChildren(cell);
        button.setAttribute("aria-expanded", "true");
        button.setAttribute("aria-controls", detailId);
        row.dataset.open = "true";
        const controller = new AbortController();
        const current = { row, detail, controller, destroy: undefined as (() => void) | undefined };
        active = current;
        const toolbar = el("div", "", "replay-toolbar");
        toolbar.append(el("strong", `${row.dataset.day} · CL1! · 1 minute · MYT`));
        const hide = el("button", "Hide chart", "toggle");
        hide.type = "button";
        hide.addEventListener("click", () => { close(); button.focus({ preventScroll: true }); });
        toolbar.append(hide);
        cell.append(toolbar);
        const body = el("div"); cell.append(body);
        let request = 0;
        async function load() {
          const seq = ++request;
          current.destroy?.(); current.destroy = undefined;
          const loading = el("p", "Loading real prices… The first chart verifies the full backtest and can take a few seconds.", "replay-note");
          loading.setAttribute("role", "status");
          body.replaceChildren(loading);
          body.setAttribute("aria-busy", "true");
          try {
            const query = new URLSearchParams({ strategy, key, day: row.dataset.day!, generated: generated! });
            // Download the renderer while the server prepares the verified replay.
            const [response, chartRenderer] = await Promise.all([
              fetch(`/__trade-replay?${query}`, { signal: controller.signal }), loadRenderer(),
            ]);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? `Server answered ${response.status}`);
            if (seq !== request || active !== current) return;
            const replay = data as TradeReplay;
            if (replay.strategy !== strategy || replay.key !== key || replay.day !== row.dataset.day ||
                replay.slippage !== 0 || replay.generated_utc !== generated || replay.timezone !== "Asia/Kuala_Lumpur") {
              throw new Error("Results changed. Reload the page before opening this day.");
            }
            if (!replay.trades.length) {
              body.replaceChildren(el("p", "No trades closed on this day.", "replay-note"));
              return;
            }
            if (seq !== request || active !== current) return;
            body.replaceChildren();
            current.destroy = chartRenderer.renderReplay(body, replay);
          } catch (error) {
            if (controller.signal.aborted || seq !== request || active !== current) return;
            const message = el("p", `Could not open this chart. ${error instanceof Error ? error.message : String(error)}`, "replay-note");
            message.setAttribute("role", "status");
            const retry = el("button", "Try chart again", "toggle"); retry.type = "button";
            retry.addEventListener("click", load);
            body.replaceChildren(message, retry);
          } finally { if (seq === request) body.removeAttribute("aria-busy"); }
        }
        void load();
      });
    }

    async function loadEarlier() {
      more.disabled = true; more.textContent = "Loading earlier days…"; status.textContent = "";
      try {
        if (!table) {
          const response = await fetch(periodFileUrl(strategy, key, "day"));
          if (!response.ok) throw new Error(`server answered ${response.status}`);
          const doc = await response.json();
          const meta = doc as Record<string, unknown>;
          if (!isPeriodTable(doc) || String(meta.export_version) !== version || meta.generated_utc !== generated ||
              meta.strategy !== strategy || meta.key !== key || meta.grain !== "day" || meta.timezone !== "Asia/Kuala_Lumpur") {
            throw new Error("Results changed. Reload the page.");
          }
          table = doc;
        }
        const indices = table.periods.map((_, i) => i).filter(i => table!.net["0"][i] !== null).sort((a, b) => table!.periods[b].localeCompare(table!.periods[a]));
        const fragment = document.createDocumentFragment();
        for (const i of indices.slice(displayed, displayed + PAGE_SIZE)) {
          const row = el("tr"); row.dataset.day = table.periods[i];
          const heading = el("th", "", "mono"); heading.scope = "row";
          const label = el("span", table.periods[i]); label.dataset.dayLabel = "";
          heading.append(label); row.append(heading);
          for (const k of SCENARIO_KEYS) {
            const value = table.net[k][i];
            const cell = el("td", value === null ? "–" : usd(value, { cents: false }), `num ${tone(value)}`);
            if (value === null) cell.setAttribute("aria-label", "no trades");
            row.append(cell);
          }
          wireRow(row); fragment.append(row);
        }
        rows.append(fragment);
        displayed = Math.min(displayed + PAGE_SIZE, indices.length);
        count.textContent = `${displayed.toLocaleString("en-US")} of ${indices.length.toLocaleString("en-US")} days`;
        more.hidden = displayed >= indices.length;
      } catch (error) {
        status.textContent = `Could not load earlier days: ${error instanceof Error ? error.message : String(error)}`;
      } finally { more.disabled = false; more.textContent = "Show earlier days"; }
    }
    more.hidden = displayed >= Number(root.dataset.total);
    more.addEventListener("click", loadEarlier);
    // Capability comes from the server; public builds never assume private market data is available.
    if (root.dataset.replay === "local") void (capability ??= fetch("/__trade-replay/status").then(r => r.ok ? r.json() : null).catch(() => null)).then(result => {
      if (!result?.available) return;
      interactive = true;
      root.querySelector<HTMLElement>("[data-chart-hint]")!.hidden = false;
      rows.querySelectorAll<HTMLTableRowElement>("[data-day]").forEach(wireRow);
      // Prepare the latest day shortly before its list enters view. Hidden tabs do no work.
      // One request per table; the worker validates and caches it for the eventual click.
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        const day = rows.querySelector<HTMLElement>("[data-day]")?.dataset.day;
        if (!day || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
        const query = new URLSearchParams({ strategy, key, day, generated: generated! });
        void loadRenderer().catch(() => {});
        void fetch(`/__trade-replay?${query}`).catch(() => {});
      }, { rootMargin: "300px" });
      observer.observe(root);
    }).catch(() => {});
  }
}
