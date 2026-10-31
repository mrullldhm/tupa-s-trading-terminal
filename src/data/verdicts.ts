// Hand-written verdicts for feature-2 runs. Judgements, not numbers: each cites where it was decided.
// Source: docs/strategies/fair_price_reversal/experiments.md, "Verdict (feature 2, 2026-10-31)".
export type Verdict = { verdict: "candidate" | "rejected"; reason: string };

export const F2_VERDICTS: Record<string, Record<string, Verdict>> = {
  fair_price_reversal: {
    ny_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Profitable at 0, 1 and 2 ticks. All 6 neighbours stay above zero at 1 tick (a plateau, not a spike). Matches the cost idea declared before the search. Codex rebuilt it independently and got the same trades.",
    },
    london_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Turns the baseline from a loss into a profit at 1 tick and stays positive at 2 ticks. Neighbours at 28 and 32 ticks hold up. But 2022 alone made 58% of the 1-tick profit.",
    },
    asia_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "No trial with at least 300 trades made money at 1 tick. Asia has too few trades for filters to work.",
    },
    ny_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Profitable, but below the simpler NY filter run. Changing the base settings added nothing on top of the risk filter.",
    },
    london_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Loses at 2 ticks, and 6 of its 17 neighbours lose at 1 tick. Fails the plateau check.",
    },
    asia_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Loses at 1 tick. None of its 10 neighbours made money at 1 tick.",
    },
  },
};
