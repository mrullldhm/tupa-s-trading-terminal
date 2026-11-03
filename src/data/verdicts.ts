// Hand-written verdicts for feature-2 runs. Judgements, not numbers: each cites where it was decided.
// Sources: docs/strategies/<strategy>/optimize/README.md, "Verdict" sections (2026-10-31).
export type Verdict = { verdict: "candidate" | "rejected"; reason: string };

export const F2_VERDICTS: Record<string, Record<string, Verdict>> = {
  fair_price_reversal: {
    ny_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    london_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    asia_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    ny_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    london_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    asia_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
  },
  supertrend_kalman: {
    ny_filters_random_net1_s1_n200: {
      verdict: "candidate",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    ny_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    all_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    all_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    london_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    london_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    asia_filters_random_net1_s1_n200: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
    asia_full_tpe_net1_s1_n300: {
      verdict: "rejected",
      reason: "Historical verdict under the previous test rules. Re-evaluation is pending after the limit-entry updates.",
    },
  },
};
