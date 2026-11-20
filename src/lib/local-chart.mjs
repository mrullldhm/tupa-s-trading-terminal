import { readFile } from "node:fs/promises";

/** @param {string} strategyId @returns {Promise<import("../data/setup-chart").SetupChart | null>} */
export async function loadLocalChart(strategyId) {
  const file = new URL(`../../../results/${strategyId}/web-chart.json`, import.meta.url);
  try {
    const chart = JSON.parse(await readFile(file, "utf8"));
    const supported = chart?.schema === 2 && typeof chart.signalTf === "string" && Array.isArray(chart.views)
      && chart.views.some((view) => view.tf === chart.signalTf);
    return supported ? chart : null;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return null;
  }
}
