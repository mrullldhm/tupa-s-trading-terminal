// Click-to-sort for every table[data-sortable]. Headers become buttons at runtime; without JS the table keeps its
// server order. A cell's sort value is its data-v, else a number parsed from its text, else its text.
// th[data-dir="asc"] marks lower-is-better columns (first click shows lowest first); text columns also start A→Z.
function parse(td: HTMLTableCellElement | undefined): number | string {
  if (!td) return "";
  if (td.dataset.v != null) {
    const n = Number(td.dataset.v);
    return Number.isNaN(n) ? td.dataset.v : n;
  }
  const t = td.textContent!.replace(/\s+/g, " ").trim();
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const m = t.replace(/[−–]/g, "-").replace(/[,$+]/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KkM%])?/);
  if (!m) return t.toLowerCase();
  return Number(m[1]) * (m[2] === "K" || m[2] === "k" ? 1e3 : m[2] === "M" ? 1e6 : 1);
}

for (const table of document.querySelectorAll<HTMLTableElement>("table[data-sortable]")) {
  const tbody = table.tBodies[0];
  const heads = [...table.tHead!.rows[0].cells];
  const buttons: HTMLButtonElement[] = [];

  heads.forEach((th, col) => {
    if (th.hasAttribute("data-nosort")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sort";
    b.append(...th.childNodes);
    th.append(b);
    buttons.push(b);

    b.addEventListener("click", () => {
      const rows = [...tbody.rows];
      const vals = new Map(rows.map((r) => [r, parse(r.cells[col])]));
      const text = rows.every((r) => typeof vals.get(r) === "string");
      const first = text || th.dataset.dir === "asc" ? "ascending" : "descending";
      const cur = th.getAttribute("aria-sort");
      const dir = cur ? (cur === "ascending" ? "descending" : "ascending") : first;
      for (const h of heads) h.removeAttribute("aria-sort");
      th.setAttribute("aria-sort", dir);
      const sign = dir === "ascending" ? 1 : -1;
      rows.sort((a, c) => {
        const x = vals.get(a)!, y = vals.get(c)!;
        // Numbers before text ("no pass", blanks) in either direction.
        if (typeof x !== typeof y) return typeof x === "number" ? -1 : 1;
        return sign * (typeof x === "number" ? x - (y as number) : x.localeCompare(y as string));
      });
      tbody.append(...rows);
    });
  });
}
