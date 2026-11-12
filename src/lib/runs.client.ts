// Filter chips + sortable columns for the runs table. Without JS the table still renders, sorted best first.
const root = document.querySelector<HTMLElement>("[data-runs]");
if (root) {
  const tbody = root.querySelector("tbody")!;
  const rows = [...tbody.querySelectorAll<HTMLTableRowElement>("tr")];
  const count = root.querySelector<HTMLElement>("[data-count]")!;
  const pills = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  const heads = [...root.querySelectorAll<HTMLButtonElement>("[data-sort]")];

  for (const p of pills) {
    p.addEventListener("click", () => {
      const f = p.dataset.filter!;
      for (const q of pills) q.setAttribute("aria-pressed", String(q === p));
      let shown = 0;
      for (const r of rows) {
        const on = f === "all" || r.dataset.strategy === f;
        r.hidden = !on;
        if (on) shown++;
      }
      count.textContent = String(shown);
    });
  }

  for (const h of heads) {
    h.addEventListener("click", () => {
      const key = h.dataset.sort!;
      const th = h.closest("th")!;
      const desc = th.getAttribute("aria-sort") !== "descending";
      for (const o of heads) o.closest("th")!.removeAttribute("aria-sort");
      th.setAttribute("aria-sort", desc ? "descending" : "ascending");
      const val = (r: HTMLTableRowElement) => (key === "name" ? r.dataset.name! : Number(r.dataset[key]));
      // Lower cost per pass is better, so "descending" means best first there too.
      const flip = key === "cost" || key === "name" ? -1 : 1;
      rows.sort((a, b) => {
        const x = val(a), y = val(b);
        const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
        return (desc ? -c : c) * flip;
      });
      tbody.append(...rows);
    });
  }
}
