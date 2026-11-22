import { readFile } from "node:fs/promises";

const directory = new URL("../../../results/tupa_1/web-setups-sweep/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"));

/** @param {string | null} selected @param {number} total */
const selection = (selected, total) => selected && /^\d+$/.test(selected) && total > 0
  ? Math.max(1, Math.min(total, Number(selected))) : 0;

/**
 * @param {readonly import("../data/tupa-setups").TupaSetupGroup[]} definitions
 * @param {URLSearchParams} query
 * @returns {Promise<null | {first: number, last: number, groups: {
 *   id: import("../data/tupa-setups").TupaGroup, total: number, number: number, legacyAnchor: string | null,
 *   chart: import("../data/setup-chart").PatternChart | null
 * }[]}>}
 */
export async function loadTupaSetups(definitions, query) {
  try {
    const index = await read("index.json");
    const groups = await Promise.all(definitions.map(async ({ id, source, method }) => {
      /** @type {{key: string, method: import("../data/tupa-setups").TupaSetupGroup["method"]}[]} */
      const combined = index.groups[source];
      const items = combined.filter((item) => item.method === method);
      const total = items.length;
      // Preserve links to an ordinal in the former combined inside-candle-3 section.
      const legacy = source !== id ? combined[selection(query.get(source), combined.length) - 1] : undefined;
      const legacyNumber = legacy ? items.findIndex((item) => item.key === legacy.key) + 1 : 0;
      const legacyAnchor = (legacy ? legacyNumber > 0 : method === "sweep") ? source : null;
      const number = selection(query.get(id), total) || legacyNumber || total;
      return { id, total, number, legacyAnchor, chart: total ? await read(`${items[number - 1].key}.json`) : null };
    }));
    return { groups, first: index.first, last: index.last };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return null;
  }
}
