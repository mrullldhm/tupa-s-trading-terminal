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
];

export const textFor = (id: string) => {
  const t = STRATEGY_TEXT.find((s) => s.id === id);
  if (!t) throw new Error(`No text for strategy ${id}`);
  return t;
};
