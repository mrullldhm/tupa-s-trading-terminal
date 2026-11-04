// Hand-written verdicts for feature-2 runs. Judgements, not numbers: each cites where it was decided.
// Sources: current owner-swing search reports and saved neighbour tables (2026-11-04).
export type Verdict = { verdict: "candidate" | "rejected"; reason: string };

export const F2_VERDICTS: Record<string, Record<string, Verdict>> = {
  fair_price_reversal: {
    ny_full_tpe_net0_s1_n300: {
      verdict: "candidate",
      reason: "Positive development profit, 1,634 trades and all 11 tested neighbours positive. This full search is exploratory; the declared F3 protocol covers the random filters-only searches.",
    },
    london_full_tpe_net0_s1_n300_recovery_20261104: {
      verdict: "rejected",
      reason: "The best full-search result is below the filters-only candidate on the same development interval. All nine tested neighbours were positive, but the wider search did not improve the selected result.",
    },
    asia_full_tpe_net0_s1_n300_recovery_20261104: {
      verdict: "candidate",
      reason: "Positive development profit, 493 trades and all 15 tested neighbours positive. This full search is exploratory; the declared F3 protocol covers the random filters-only searches.",
    },
    ny_filters_random_net0_s1_n200: {
      verdict: "candidate",
      reason: "Positive development net profit, 1,739 trades and all three tested neighbours positive under fixed owner swings. F3 determines advancement.",
    },
    london_filters_random_net0_s1_n200: {
      verdict: "candidate",
      reason: "Positive development net profit, 1,423 trades and all six tested neighbours positive under fixed owner swings. F3 determines advancement.",
    },
    asia_filters_random_net0_s1_n200: {
      verdict: "candidate",
      reason: "Positive development net profit, 580 trades and all six tested neighbours positive under fixed owner swings. F3 determines advancement.",
    },
  },
};
