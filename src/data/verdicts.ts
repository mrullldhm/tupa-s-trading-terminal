// Hand-written verdicts for feature-2 runs. Judgements, not numbers: each cites where it was decided.
// Sources: docs/strategies/<strategy>/optimize/README.md, "Verdict" sections (2026-10-31).
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
  supertrend_kalman: {
    ny_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Passes every rule declared before the search: profitable at 1 and 2 ticks, 3 of 3 neighbours above zero, no year above 32% of the profit. Only raises the baseline's own RVI threshold from 50 to 55. Codex rebuilt it independently and got the same trades.",
    },
    ny_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Also passes the rules, but the rule declared in advance sends the run with fewer changes forward (the filters-only run). Lands within $2,000 of it: the New York baseline carries both.",
    },
    all_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Stop of at least 100 ticks: profitable even at 2 ticks, exactly the cost idea declared in advance. But 2022 alone made 53.5% of the 1-tick profit, over the 50% limit set before the search. A bet on volatile years.",
    },
    all_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "The biggest number of the study: profitable even at 2 ticks. But 2022 alone made 92.7% of the 1-tick profit and 7 of 14 years lost money. Two changed settings and four filters fitted one year.",
    },
    london_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Loses money at 2 ticks.",
    },
    london_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Barely positive at 2 ticks, but 2022 made 65% of the 1-tick profit, and only exactly two thirds of its neighbours held up.",
    },
    asia_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Loses money at 2 ticks, and 3 of its 9 neighbours lose at 1 tick.",
    },
    asia_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Loses money at 2 ticks.",
    },
  },
};
