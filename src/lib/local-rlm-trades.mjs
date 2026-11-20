import { readFile } from "node:fs/promises";

const directory = new URL("../../../results/rlm/web-all-hours/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));

/**
 * @param {URLSearchParams} query
 * @returns {Promise<null | {flat: number, groups: {id: "wins" | "losses", total: number, number: number, chart: import("../data/setup-chart").SetupChart}[]}>}
 */
export async function loadRlmTrades(query) {
  try {
    const index = await read("index.json");
    const ids = /** @type {const} */ (["wins", "losses"]);
    const groups = await Promise.all(ids.map(async (id) => {
      const items = index[id];
      const total = items.length;
      const requested = query.get(id);
      const number = requested && /^\d+$/.test(requested) ? Math.max(1, Math.min(total, Number(requested))) : total;
      const trade = items[total - number];
      return { id, total, number, chart: await read(`${trade.id}.json`) };
    }));
    return { groups, flat: index.flat };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return null;
  }
}
