// Hand-written plain-English text for each strategy. Numbers never live here: they come from research.json.
// Source of truth for the wording: ../docs/strategies/<id>/README.md.

export interface StrategyText {
  id: string;
  slug: string;
  name: string;
  short: string;
  source: { label: string; url: string | null; note: string };
  idea: string;
  rules: string[];
  verdict: string;
  lessons: string[];
  /** Shown wherever the strategy is featured (overview card): a warning the numbers alone would hide. */
  caveat?: string;
}

export const STRATEGY_TEXT: StrategyText[] = [
  {
    id: "purple_pa",
    slug: "yesterdays-levels",
    name: "Yesterday's High and Low",
    short: "Buy or sell the first bounce off yesterday's high or low.",
    source: {
      label: "Purple Trading article",
      url: null,
      note: "One hand-picked 10-day oil example with 6 trades. No costs, no backtest.",
    },
    idea: "Many traders watch yesterday's high and low. The first time price comes back to one of these levels, it often bounces. We wait for a small gap in price moving away from the level as proof, then join the bounce.",
    rules: [
      "Levels: the high and low of the previous trading day.",
      "Only the first touch of a level trades. If the level breaks, one retest from the other side is allowed.",
      "Proof: within 4 candles, a gap opens between candle 1 and candle 3 in the bounce direction.",
      "Entry: a limit order at the edge of that gap, live for 4 candles.",
      "Stop: 1 tick past the lowest low (or highest high) since the touch. Target: same distance as the stop (1 : 1).",
      "1 contract. Every trade closes by 3:10 PM Chicago time.",
    ],
    verdict: "The best of the six, and still not good enough. It makes a small profit, but its profit factor (1.20 and 1.24) stays under the 1.25 bar, and the 5-minute version lost money four years in a row (2018 to 2021).",
    lessons: [
      "The edge is real but thin: trades that clearly traded through the entry price still made money.",
      "The 15-minute version leans on one good year (2011).",
      "A next step, like trading only with the trend, would be a new idea with its own test budget.",
    ],
  },
  {
    id: "swapnil_hm",
    slug: "rsi-strength-push",
    name: "RSI Strength Push",
    short: "Join a strong RSI push when price is above its averages.",
    source: {
      label: "Swapnil227-arch / algo-trading-framework",
      url: "https://github.com/Swapnil227-arch/algo-trading-framework",
      note: "Built on 4-hour USD/JPY data. Settings tuned on the same data that was tested.",
    },
    idea: "When RSI is extreme and price sits above both its 20-candle average and the day's VWAP, the push is strong. The idea is that it keeps going a fixed distance further.",
    rules: [
      "Candles: 4 hours (source) and 1 hour.",
      "Buy when RSI(14) is above 75, the fast RSI line is above the slow one, and price is above the 20-candle average and VWAP. Sell is the mirror, with RSI below 20.",
      "Entry: a limit order at the signal candle's close, live for one candle.",
      "Stop and target: copied from the source and scaled from yen to oil by percent of price (about 2 to 3%).",
      "The stop moves after every finished candle, as in the source code.",
      "1 contract. Every trade closes by 3:10 PM Chicago time.",
    ],
    verdict: "Fails. A first run looked good (+$21.5K on 1-hour candles), but that came from a data bug: some signals used candles from the previous session. After the fix it is close to break-even.",
    lessons: [
      "74% of trades never reach their stop or target; they simply close at 3:10 PM.",
      "A bug fix can wipe out a result. That is why every result is checked against raw bars.",
    ],
  },
  {
    id: "xtley_gap",
    slug: "stretch-back-to-average",
    name: "Stretch Back to the Average",
    short: "In a quiet market, bet that a stretched price returns to its long average.",
    source: {
      label: "Xtley001 / Mean-Reversion-Gap-Strategy-Trading-Bot",
      url: "https://github.com/Xtley001/Mean-Reversion-Gap-Strategy-Trading-Bot",
      note: "A MetaTrader bot for forex. Its own oil settings were used. No results given.",
    },
    idea: "When the market is calm and price has moved more than 0.6% away from its long average (EMA 360), but is already turning back, it should drift back toward that average.",
    rules: [
      "Candles: 5, 15 or 30 minutes. Calm market = short ATR below long ATR.",
      "Buy when price is 0.6% below EMA 360, back above EMA 20, and RSI is falling (as written in the source). Sell is the mirror.",
      "Entry: a limit order 2 ticks better than the close, live for 5 candles.",
      "Stop: 1.5 × ATR. Target: 5 times the stop.",
      "Two versions: with the source's trailing stop, and without it (the source bug means the trail likely never ran live).",
      "1 contract. Every trade closes by 3:10 PM Chicago time.",
    ],
    verdict: "Fails. All six versions sit around break-even or below. Touch fills add roughly $5 per trade of hidden help, so after that every version loses.",
    lessons: [
      "Six versions tried, so even the best one is 'best of 6' and probably flattered.",
      "Only completed candles are used here; the source peeked at the live, unfinished candle.",
    ],
  },
  {
    id: "swapnil_momentum",
    slug: "two-candles-in-a-row",
    name: "Two Candles in a Row",
    short: "Two green candles mean buy, two red candles mean sell.",
    source: {
      label: "Swapnil227-arch / algo-trading-framework",
      url: "https://github.com/Swapnil227-arch/algo-trading-framework",
      note: "Claims steady monthly returns. Its backtest checked exits on the signal candle itself (it saw the future).",
    },
    idea: "Two candles of the same colour show momentum. The next move should go at least one stop-size further in the same direction.",
    rules: [
      "Candles: 4 hours (source), 1 hour and 15 minutes.",
      "Buy after two green candles. Sell after two red candles.",
      "Entry: a limit order at the signal candle's close, live for one candle.",
      "Stop: just past the signal candle. Target: 1 or 3 times the stop, depending on stop size (source rule).",
      "1 contract. Every trade closes by 3:10 PM Chicago time.",
    ],
    verdict: "Fails on every timeframe. It wins about 48% of the time with mostly 1 : 1 targets, which is a coin flip. Each trade then loses the fee.",
    lessons: [
      "More trades do not help a coin flip: the 15-minute version made 51,612 trades and lost the most.",
    ],
  },
  {
    id: "scribd_supertrend",
    slug: "supertrend-ema-vortex",
    name: "Supertrend + EMA + Vortex",
    short: "Trade when three trend tools all agree.",
    source: {
      label: "Scribd document 376948099",
      url: "https://www.scribd.com/document/376948099",
      note: "A 2-page setup written for Indian MCX crude in rupees. No results given.",
    },
    idea: "When Supertrend, the EMA 8 / EMA 21 order and a strong Vortex reading all point the same way, the move should continue 10 to 15 points.",
    rules: [
      "Candles: 15 minutes. Signal on the first candle of the day where all three agree.",
      "Buy: Supertrend up, EMA 8 above EMA 21, Vortex plus above 1.1 and minus below 0.9. Sell is the mirror.",
      "Entry: a limit order at the signal close, live for one candle.",
      "Stop: ATR plus 4 points. Points were converted from rupees to oil by price.",
      "Two exits: a trailing stop after +10 points, or a fixed +15 point target.",
      "1 contract. Every trade closes by 3:10 PM Chicago time.",
    ],
    verdict: "Fails. It lost money in 11 of 12 years for both exits. The fixed target wins about half the time at 1 : 1, so the fee eats it.",
    lessons: ["Three trend filters agreeing did not add an edge on oil."],
  },
  {
    id: "ict_ea",
    slug: "ict-confluence-score",
    name: "ICT Confluence Score",
    short: "Score ICT signals (structure, gaps, order blocks) and trade a high score.",
    source: {
      label: "hungpixi / ict-system-ea",
      url: "https://github.com/hungpixi/ict-system-ea",
      note: "A MetaTrader 5 bot for gold. Shows only screenshots of its own backtest.",
    },
    idea: "Add up ICT signals: trend structure, a break of structure, discount or premium zone, a fair value gap, an order block and the daily bias. A score of 3 or more should lead to a 2 : 1 win.",
    rules: [
      "Structure on 1-hour candles, using the owner's swing point rule.",
      "Signals checked on every finished 5-minute candle. Trade when one side scores 3 or more and beats the other side.",
      "Entry: a limit order at the 5-minute close, live for 5 minutes.",
      "Stop: below the order block or last swing low. Target: 2 times the stop. Size: risk $250, 1 to 5 contracts.",
      "Management from the source: move stop to entry at 0.5R, take part profit at 1R, close losers after 2 hours.",
      "Daily limits: 3 trades, stop after 2 losses in a row, stop at −$1,000 or +$750.",
    ],
    verdict: "Fails badly. It loses even before fees. The 57% win rate comes from many tiny protected wins, while losses are full stops.",
    lessons: [
      "A high win rate can still lose money when wins are small and losses are full size.",
      "Requiring every signal to agree (score 7 of 7) cut trades from 8,499 to 3,190 but lost more per trade. Full confluence adds no edge.",
    ],
  },
  {
    id: "swing_point_failure",
    slug: "swing-point-failure",
    name: "Swing Point Failure",
    short: "Sell a swing low that fails before the next swing high (buy the mirror).",
    source: {
      label: "Owner's own setup",
      url: null,
      note: "Described by the owner with three chart examples from November 2026. The code matches all three.",
    },
    idea: "Swing points come in turns: low, high, low, high. When price makes a swing low but comes back to it before any swing high forms, the low has failed. Sellers are in control. We wait for the first small bounce to break, then sell with them.",
    rules: [
      "Structure on 1-hour candles (4-hour in one version), using the owner's swing point rule.",
      "Setup: the newest point is a swing low, and price touches it again before a swing high is confirmed.",
      "The setup is off if the bounce reaches the high of the 1-hour candle before the touch, or a new swing point forms.",
      "Bounce: the first of the 1-minute or 5-minute charts to show a higher low. The trigger is the candle that breaks the newest higher low.",
      "Stop: the highest high since that higher low. Entry: a limit at the trigger close, or 15, 20 or 25 ticks below the stop when the stop is further away. Target: twice that (30, 40 or 50 ticks), or in three later 1-hour versions the same distance (15, 20 or 25 ticks).",
      "1 contract per setup. A new setup cancels an order that has not filled; filled trades keep running (up to 5 at once).",
    ],
    verdict: "Fails every check. All 15 versions lose money, before and after fees, and no version is positive in more than 3 of 12 years.",
    lessons: [
      "The stop sits on the bounce's swing high, which on 1-minute charts is usually only a few ticks away. Normal noise stops most trades out long before the 50-tick target.",
      "The owner's chart examples had stops of 17 to 38 ticks. Most real setups are much smaller.",
      "A closer target (the same size as the largest allowed stop) wins more often, up to 23% of trades, but still loses before fees. The tiny stop, not the far target, is the problem.",
      "Which timeframe wins a tie barely matters: the 1-minute chart shows the higher low first almost every time.",
    ],
  },
  {
    id: "swing_point_failure_reversal",
    slug: "swing-point-failure-reversal",
    name: "Swing Point Failure Reversal",
    short: "When a Swing Point Failure sell gets stopped, buy instead (and the mirror).",
    source: {
      label: "Owner's own setup",
      url: null,
      note: "Proposed by the owner in November 2026 after Swing Point Failure trades hit their stop 84–90% of the time.",
    },
    idea: "Swing Point Failure sells are stopped out most of the time. If price climbs back to the sell's stop, the bounce it sold into was not over: buyers won. So trade with them: buy when the sell's stop is touched, with a stop under the newest low.",
    rules: [
      "Source: every Swing Point Failure signal on 1-hour swings, both directions, whether or not its order filled.",
      "Trigger: the first touch of that signal's stop, the same day, before the next Swing Point Failure signal. We act at the close of the 1-minute or 5-minute candle (the setup's own chart) that touched it.",
      "Stop: the lowest low since the newest swing high on that chart. Two more versions take the swing high from the 5-minute or 15-minute chart instead, which gives a wider stop.",
      "Entry: a limit at the trigger close, or 15, 20 or 25 ticks above the stop when the stop is further away. Target: twice that, so 30, 40 or 50 ticks.",
      "1 contract per setup. The next Swing Point Failure signal cancels an order that has not filled; filled trades keep running.",
    ],
    verdict: "Fails every check. All 5 versions lose money after fees and none is positive in more than 4 of 12 years. The best one (stop from 15-minute swings) passes the Combine in about 1 attempt in 5.",
    lessons: [
      "The idea was picked after seeing the source strategy's results, so even a pass would need clean data to mean anything.",
      "Same problem as the source: on the setup's own chart the newest low is usually only a few ticks below the entry (median 7 ticks), while the target is 30 to 50 ticks away.",
      "Taking the stop from 5-minute or 15-minute swings helps: a wider stop (median 10 ticks on 15-minute swings), more years in profit and about double the Combine pass rate. Still not enough.",
      "The better versions make money before fees (up to +$8,880 over 12 years). Fees on about 6,500 trades turn every one into a loss.",
    ],
  },
  {
    id: "pd_swing",
    slug: "previous-day-level-swing-structure",
    name: "Previous-Day Level + Swing Structure",
    short: "Yesterday's high or low, first touch only, filtered by the owner's swing structure on a higher chart.",
    source: {
      label: "Owner's swing rule + Yesterday's High and Low",
      url: null,
      note: "Built in November 2026 from a study of 1.9 million swing points: swing points alone behave like a coin flip, so the owner's structure was tested as a filter on the closest working idea.",
    },
    idea: "Yesterday's High and Low makes money before fees but trades rarely. The owner's structure (higher-chart trend, a lower-chart failure that gets reclaimed, the manipulation candle) should pick out the better bounces, while keeping Yesterday's High and Low's wide stop and 1 : 1 target.",
    rules: [
      "Levels: yesterday's high and low. Only the first touch of each level per day counts, traded or not.",
      "Chart pairs: 5-minute candles with 1-hour structure, and 15-minute candles with 4-hour structure. The higher chart's last swing point must not break before the order fills.",
      "P1: the higher chart is in an uptrend (higher high and higher low) for a buy at the low; mirror for a sell.",
      "P2: after the touch, price breaks the last lower-chart higher low (P2-a), or breaks it and then reclaims the next lower high (P2-b).",
      "P3: the owner's manipulation candle at the level: a candle breaks a swing high, the next candle takes its low into yesterday's low; P3-b also waits for the breakout high to be reclaimed.",
      "Entry for all: Yesterday's High and Low's gap entry (a limit at the gap edge for 4 candles), stop beyond the whole move, target 1 : 1. 1 contract.",
    ],
    verdict: "Dropped. Every version fails the 200-trade check by a wide margin (0 to 72 trades in 12 years) and none beats plain Yesterday's High and Low on profit per trade before fees.",
    lessons: [
      "The structure filters remove about 90% of trades without picking better ones.",
      "The manipulation candle lines up with a first touch of yesterday's level only about 60 to 75 times in 12 years, and the higher-chart swing low survives in very few of them: at yesterday's levels, a sweep usually takes the higher-chart swing too.",
      "The P2-b version has no time limit, so a touch can turn into a slow breakdown hours before the reclaim.",
    ],
  },
  {
    id: "purple_levels",
    slug: "fixed-levels",
    name: "Fixed Levels: Day, Week and Swing Points",
    short: "Yesterday's High and Low's rules on more levels fixed at the open: last week's high and low, and 4-hour and daily swing points.",
    source: {
      label: "Yesterday's High and Low + owner's swing rule",
      url: null,
      note: "Built in November 2026. Yesterday's High and Low trades only about 4 times a month, too slow for the Combine. The owner's swing points failed as entry signals in a study, so here they are used as levels instead.",
    },
    idea: "Yesterday's high and low work because they are fixed before the day starts and many traders watch them. Other levels fixed at the open should work the same way: last week's high and low, and the newest 4-hour and daily swing high and low (owner's swing rule). More levels means more trades at the same quality.",
    rules: [
      "Levels for the day, fixed at the 17:00 Chicago open: yesterday's high and low, last week's high and low, the newest 4-hour swing high and low, the newest daily swing high and low. Five sets: each on its own, and all four together.",
      "Everything else is Yesterday's High and Low unchanged: the first test of each level (plus one retest after it breaks), a gap away from the level within 4 candles, a limit at the gap edge for 4 candles, a stop 1 tick beyond the extreme since the test, a 1 : 1 target, 1 contract, flat by 3:10 PM Chicago time.",
      "Charts: 5-minute and 15-minute candles. Two later versions on 5-minute drop yesterday's levels.",
      "A sensitivity check fills an entry only when price trades 1 tick through the limit, instead of on a touch.",
    ],
    verdict: "Dropped. The best result on build data so far, and it failed the check on new data twice. All four level sets together on 5-minute candles trade about 100 times a year and pass 4 of the 5 checks on 2010–2021 (cost per pass $580 against $500). On 2022–2024, run once with frozen settings, it made money in only 1 of 3 years. The strongest build version (all levels except yesterday's) was then checked too and also missed the profit factor and pass rate bars, with touch fills and with strict fills.",
    lessons: [
      "The owner's swing points did not work as entry signals, but as levels fixed at the open they beat yesterday's high and low: daily swing levels make about $63 per trade before fees on 5-minute candles, against $26 for yesterday's levels.",
      "5-minute candles beat 15-minute candles for every level set.",
      "Strict fills (price must trade 1 tick through the limit) cut the build-period edge but do not remove it, most of all for week and swing levels. Yesterday's levels lose most of their edge under strict fills.",
      "On 2022–2024 the profit came from 10 days and from fills that only touched the limit; fills that traded through lost money. That pattern is what an edge from the fill rule looks like, not from the market.",
      "Both checks on 2022–2024 were carried by 2023 and by about 10 good days; without them both lose money.",
      "All numbers are in-sample and best of 16 tries on build data. The second check shares most of its trades with the first, so it is not fully independent.",
    ],
  },
  {
    id: "swing_point_manipulation",
    slug: "swing-point-manipulation",
    name: "Swing Point Manipulation",
    short: "A 1-hour candle sweeps the last candle's low, then breaks its high: buy the break (and the mirror).",
    source: {
      label: "Owner's own setup",
      url: null,
      note: "Proposed by the owner in November 2026, with a worked example from 13 November 2026.",
    },
    idea: "After a 1-hour swing high and then a swing low, price tries to build the next swing high. If the next 1-hour candle first takes the previous candle's low and then its high, the dip was a run on the stops below that low, not a turn down. Buy the break and aim for the last swing high.",
    rules: [
      "Setup (1-hour candles, owner swing rule): the newest points are a swing high, then a swing low. Candle 2's high is equal to or above candle 1's high.",
      "Trigger: inside candle 3, price first touches candle 2's low and later touches candle 2's high, in the same hour. A touch of the high first, or both in one minute, does not count.",
      "Entry: at the close of the 15-minute candle that broke candle 2's high. Stop: that 15-minute candle's low. Limit at its close, or 15, 20 or 25 ticks above the stop when the close is further away. Target: the last 1-hour swing high.",
      "Target versions (15-tick stop, strict swings, wait one 15-minute candle): a fixed target 15, 30, 45, 60 or 75 ticks from the limit instead of the swing high. The order is cancelled if price reaches that target before filling.",
      "Later version: wait one more 15-minute candle; if it touches the break candle's low, skip the trade, otherwise place the same order at its close.",
      "An unfilled order is cancelled when price reaches the target first or the next setup comes. 1 contract, one trade at a time. Sells are the mirror.",
      "One candle can be both swing low and swing high. One version ignores a swing high sitting on the swing low's own candle (the owner's example needs this); the strict version does not.",
    ],
    verdict: "Fails every check. 11 of 14 versions lose money. The best (strict swings, wait one 15-minute candle, 15-tick stop, swing-high target) makes a small profit but passes the Combine in only about 1 attempt in 4. A fixed 60-tick target passes about 1 in 3, still far from the 1 in 2 we need.",
    lessons: [
      "Before fees, the first six versions are about break-even. Fees on about 1,200 trades decide the result.",
      "Waiting one more 15-minute candle that holds above the break candle's low removes about 40% of trades and turns the before-fees result positive for all three stop sizes.",
      "Only the 15-tick stop is profitable after fees. 20 and 25 ticks are not, so the edge is thin and rests on one setting.",
      "Fixed targets do not fix it. 15 and 30 ticks lose, 45 is about even, 60 and 75 make a little. The results do not improve steadily with target size (30 is the worst), so the 60-tick result looks like luck, not a pattern.",
      "The wait-one-candle and fixed-target versions were added after seeing earlier results, so the numbers are the best of 14 tries and need clean data to mean anything.",
      "Ignoring a swing high on the swing low's own candle changes almost nothing (about 35 extra trades in 12 years).",
    ],
  },
  {
    id: "purple_levels_rth",
    slug: "fixed-levels-day-session",
    name: "Fixed Levels, Day Session Only",
    short: "Fixed Levels with all four level sets on 5-minute candles, trading only from 08:30 to 13:30 Chicago time.",
    source: {
      label: "Study of Fixed Levels' build years",
      url: null,
      note: "Built in November 2026 by Claude and Codex after Fixed Levels failed its check on 2022–2024. Frozen on 17 November 2026 for live paper trading.",
    },
    idea: "Fixed Levels made almost all of its build-period profit between 08:30 and 13:30 Chicago time, the old trading-floor hours when most of the day's volume trades. Overnight, the same level touches happen in a thin market and earn about nothing once a fill has to trade through the limit. So keep only the day-session signals.",
    rules: [
      "Everything is Fixed Levels with all four level sets on 5-minute candles: first test of a level (plus one retest after it breaks), a gap away within 4 candles, a limit at the gap edge, a stop 1 tick beyond the extreme since the test, a 1 : 1 target, 1 contract, flat by 3:10 PM Chicago time.",
      "New: a signal counts only if it comes between 08:30 and 13:30 Chicago time. Its order works for 20 minutes or until 13:30, whichever is first. Levels and tests still count from the 17:00 open.",
      "Judged on strict fills: an entry counts only when price trades 1 tick through the limit. Touch fills are shown beside it.",
      "One frozen setting, no tuning. No changes until the review on 17 November 2027.",
    ],
    verdict: "Frozen for live paper trading; not a result yet. The day-session window was picked after looking at the build years, from a strategy that already failed its check on 2022–2024. That choice is why the build numbers look strong. 2022–2024 is spent for this family and the 2025–2026 final exam is too short to judge it (about 23 trades a year), so only new data after 17 November 2026 can.",
    lessons: [
      "On build data the day session carries the edge: under strict fills, day-session trades earn about 0.2 of their risk per trade after fees; overnight trades earn about nothing.",
      "Even so, the cost per Combine pass on build data is about $1,000 to $1,200 (touch or strict fills), above the $500 bar. Trading more contracts does not fix it.",
      "The edge is small and was found by looking: after correcting for the many comparisons made, the day-versus-night difference is not firmly significant.",
      "Other strategies also do a little better in the day session, by about one fee per trade. That does not create an edge where a setup has none.",
      "All build numbers are in-sample and selected after the fact. Treat them as the baseline the paper trades are compared with, not as proof.",
    ],
    caveat: "The 08:30–13:30 window was picked after seeing these build years, so these numbers flatter it. Only live paper trades after 17 November 2026 can judge it.",
  },
  {
    id: "juda_swing_point",
    slug: "juda-swing-point",
    name: "Juda Swing Point",
    short: "A 15-minute swing high breaks before any pullback; one candle takes the last high, then the last low; the next candle holds above it: buy (and the mirror).",
    source: {
      label: "Owner's own setup",
      url: null,
      note: "Proposed by the owner in November 2026, with a worked example from 17 November 2026.",
    },
    idea: "In a 15-minute uptrend, a swing high that price takes out before any pullback low forms shows buyers in control. The candle that then pokes above the last candle's high and flips down through its low runs the stops under the trend. If the next candle does not go back to that low, the stop run is over: buy.",
    rules: [
      "Trend (15-minute candles): 10-period average above the 20, and the 20 above the 50 (exponential moving averages of the close).",
      "Setup (owner swing rule): the newest swing point is a swing high. A later candle touches or breaks it before any swing low forms.",
      "Manipulation candle: from that candle on, a candle first reaches the previous candle's high and then breaks the previous candle's low. The candle that breaks the swing high counts too.",
      "Confirmation: the next candle stays above the manipulation candle's low (no touch).",
      "Order: a buy limit at the confirmation candle's close, or 15 ticks above the stop when the close is further away. Stop: the confirmation candle's low, or in later versions the manipulation candle's low. Target: 15 or 30 ticks above the limit.",
      "An unfilled order is cancelled when price reaches the target first, or in later versions when the 15-minute swings make a lower high or a lower low. Also at the next setup and at 3:10 PM. 1 contract. Sells are the mirror.",
      "No setup across a contract roll: from the swing high to the order, all candles must be on one contract.",
    ],
    verdict: "Fails every check. All 6 versions lose money. The best (stop under the manipulation candle, 15-tick target, cancel on a lower high or low) loses $1,186 over 12 years on 655 trades, makes money in 7 of 12 years and never passes the Combine.",
    lessons: [
      "A stop under the confirmation candle is too tight: the median is only 6 ticks, so normal 15-minute noise stops most trades before they make 15 ticks.",
      "Moving the stop under the manipulation candle, the real stop-run low, lifts the win rate from about 28% to 40%. A 15-tick target needs about 43% to break even after fees.",
      "A study before the strategy counted the setup: about 50 to 110 a year with the trend filter, both sides together. With a market entry, it reached 1R before its stop about as often as a coin flip.",
      "The second cancel rule and the second stop were added after seeing earlier results, so every number is the best of 6 tries.",
    ],
  },
];

export const textFor = (id: string) => {
  const t = STRATEGY_TEXT.find((s) => s.id === id);
  if (!t) throw new Error(`No text for strategy ${id}`);
  return t;
};
