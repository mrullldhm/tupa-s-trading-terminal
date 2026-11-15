// Filter chips for the runs table (sorting: sort.client.ts). Without JS the table still renders, sorted best first.
const root = document.querySelector<HTMLElement>("[data-runs]");
if (root) {
  const tbody = root.querySelector("tbody")!;
  const rows = [...tbody.querySelectorAll<HTMLTableRowElement>("tr")];
  const count = root.querySelector<HTMLElement>("[data-count]")!;
  const pills = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];

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

}
