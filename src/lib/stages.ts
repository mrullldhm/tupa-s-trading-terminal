// Reader-facing names for the three test stages. F1/F2/F3 stay as short tags; the name says what the stage does.
export const STAGES = {
  f1: { tag: "F1", name: "Test every setting", short: "every setting" },
  f2: { tag: "F2", name: "Narrow search", short: "narrow search" },
  f3: { tag: "F3", name: "Validate on unseen data", short: "validation" },
} as const;

type StageKey = keyof typeof STAGES;
export const STAGE_KEYS = Object.keys(STAGES) as StageKey[];

export const STAGE_STATE_WORD = {
  done: "done",
  "in-progress": "in progress",
  pending: "pending",
  "not-started": "not started",
} as const;
