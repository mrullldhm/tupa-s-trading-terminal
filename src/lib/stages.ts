// Reader-facing names for the five test stages. F1..F5 stay as short tags; the name says what the stage does.
// Roadmap renumbered 2026-11-01: F3 checks the F2 search on the same data, F4 is the Topstep 50K prop layer, F5 is
// the one check on the reserved 2024+ data.
export const STAGES = {
  f0: { tag: "F0", name: "Test original settings", short: "original settings" },
  f1: { tag: "F1", name: "Test every setting", short: "every setting" },
  f2: { tag: "F2", name: "Narrow search", short: "narrow search" },
  f3: { tag: "F3", name: "Stress the search", short: "stress test" },
  f4: { tag: "F4", name: "Prop challenge", short: "prop challenge" },
  f5: { tag: "F5", name: "Final check on reserved data", short: "final check" },
} as const;

type StageKey = keyof typeof STAGES;
export const STAGE_KEYS = Object.keys(STAGES) as StageKey[];

export const STAGE_STATE_WORD = {
  done: "done",
  "in-progress": "in progress",
  pending: "pending",
  "not-started": "not started",
} as const;
