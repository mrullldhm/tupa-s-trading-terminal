// Studies: measurements of price behaviour, no orders and no Combine. Hand-copied from the study docs
// (../docs/studies/<id>/README.md and the findings files next to the study code). The exporter does not read
// studies, so update this file when a study is re-run. Aggregates only: never prices, never single events.

export interface Study {
  id: string;
  name: string;
  date: string; // ISO day the result was written
  question: string;
  answer: string;
  data: string;
  source: string;
}

export const studies: Study[] = [
  {
    id: "cbr-optimize",
    name: "Can the CBR trades be filtered or managed better?",
    date: "2026-11-19",
    question: "Looking at about 1,700 CBR setups at 09:30 Chicago, do losing trades share something we could skip, can losers be cut early, and can winners be told apart early so they aim higher?",
    answer: "No. Seventeen of eighteen trade features point one way in 2010-2015 and the other way in 2016-2021. Moving the stop to break-even after 1R is clearly worse, and time stops and bigger targets do not help in both periods. The setup's small edge sits mostly in 2010-2015.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "studies/cbr_optimize/",
  },
  {
    id: "cbr-screen",
    name: "Which version of the CBR model works on oil?",
    date: "2026-11-19",
    question: "The CBR model was written for gold. Across every window, trigger, bias, run filter, target and tries-per-day combination (1,728 versions), does any version pass the Combine checks, and what drives the result?",
    answer: "None passes. Half of all versions make money, as luck would give. The 09:30 to 10:30 Chicago hour is the exception: about 4 in 5 of its versions make money, and its best version beats random trades at the same times. It is still too slow and too thin with strict fills to pass the Combine, and on the check years 2022 to 2024 it about breaks even.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "studies/cbr/",
  },
  {
    id: "ghost-box-hold",
    name: "Does the overnight box hold after a failed first push?",
    date: "2026-11-18",
    question: "The Ghost Box checklist sells options outside the overnight range after the first push out fails. On oil, does price then stay inside the range until 1:30 PM Chicago?",
    answer: "No. After a failed push, a 5-minute candle closes outside the box on 92% of days, more often than on days with no push. The failed push is a warning, not a confirmation.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "studies/ghost_box/",
  },
  {
    id: "juda-count",
    name: "How often does the Juda Swing Point setup happen?",
    date: "2026-11-18",
    question: "On 15-minute candles, how often does a swing point break, then a manipulation candle and a holding candle follow, in the direction of the trend?",
    answer: "About 50 to 110 setups a year, both sides together. With a market entry it reaches 1R before its stop about as often as a coin flip.",
    data: "Build and check years, 2010-06 to 2024-12",
    source: "studies/juda_swing_point/",
  },
  {
    id: "all-strategies-improve",
    name: "Can any tested strategy be improved?",
    date: "2026-11-18",
    question: "Does any strategy so far have a real edge before fees that better settings could bring out, for example by trading only the day session?",
    answer: "Only the Fixed Levels family. The others sit at about zero or below before fees. The day session helps most strategies a little, by about one fee per trade.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "studies/all_strategies_improve/",
  },
  {
    id: "fixed-levels-improve",
    name: "Where does Fixed Levels make its money?",
    date: "2026-11-17",
    question: "Fixed Levels failed its check on 2022–2024. Is its build-period edge in some hours more than others?",
    answer: "Almost all of it comes from 08:30 to 13:30 Chicago time. Found after looking, so it became a frozen strategy for live paper trading, not a result.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "studies/purple_levels_improve/",
  },
  {
    id: "pdl-swing",
    name: "Swing points through yesterday's low or high",
    date: "2026-11-17",
    question: "How often does a swing point take out the previous day's low (or high) and then make the owner's candle shape?",
    answer: "On 4-hour candles: about 8 short and 11 long setups a year. Rare.",
    data: "Build and check years, 2010-06 to 2024-12",
    source: "docs/studies/pdl_swing_4h/",
  },
  {
    id: "level-regime",
    name: "Did fixed levels stop working after 2021?",
    date: "2026-11-16",
    question: "Fixed Levels made money on 2010-2021 and in only 1 of 3 years on 2022-2024. Did the market change?",
    answer: "No break found. The miss fits a smaller edge plus luck.",
    data: "Build and check years, 2010-06 to 2024-12",
    source: "docs/studies/level_regime/",
  },
  {
    id: "swing-confluence",
    name: "Swing points across timeframes",
    date: "2026-11-16",
    question: "When a swing point forms, do the swing points on other timeframes change whether it holds?",
    answer: "Barely. A swing point alone is a coin flip; other timeframes move it 3 to 7 points.",
    data: "Build years only, 2010-06 to 2021-12",
    source: "docs/studies/swing_confluence/",
  },
];

// Level regime: first touch of a fixed level, bounce rate minus its fair rate, in points.
export const levelEdges = [
  { set: "Previous day", build: -0.9, check: 0.8 },
  { set: "4-hour swing", build: -1.4, check: 1.0 },
  { set: "Daily swing", build: -0.5, check: -2.7 },
  { set: "Previous week", build: 2.4, check: 3.1 },
];

// Swing confluence: the cells worth naming (build years, in-sample, best of about 29,000 cells).
export const confluenceCells = [
  {
    what: "1-hour swing that formed slowly, with the 4-hour leg going the same way",
    edge: 3.7,
    n: 1796,
    note: "Best found. About +$20 a trade after fees at the swing price; with a limit order a little lower, about $0.",
  },
  {
    what: "15-minute swing low high up in the 1-hour range, with the 15-minute leg already turning down",
    edge: -6.8,
    n: 607,
    note: "Holds less than chance. A setup to skip, not one to trade.",
  },
  {
    what: "1-hour swing confirmed at the 5 PM Chicago reopen",
    edge: -5.2,
    n: 1170,
    note: "Holds less than chance. The only single feature that passed alone.",
  },
];

// PDL/PDH swing count. C3 / C4 = the two candle shapes; counts are events, build (dev) and check (validation).
export const pdlCounts = [
  { tf: "4h", side: "Short", group: "Takes yesterday's low", c3: [68, 21], c4: [19, 7] },
  { tf: "4h", side: "Short", group: "Any swing low", c3: [209, 55], c4: [84, 38] },
  { tf: "4h", side: "Long", group: "Takes yesterday's high", c3: [103, 23], c4: [26, 8] },
  { tf: "4h", side: "Long", group: "Any swing high", c3: [265, 70], c4: [77, 21] },
  { tf: "1h", side: "Short", group: "Takes yesterday's low", c3: [155, 54], c4: [39, 4] },
  { tf: "1h", side: "Short", group: "Any swing low", c3: [1123, 281], c4: [277, 81] },
  { tf: "1h", side: "Long", group: "Takes yesterday's high", c3: [187, 71], c4: [50, 12] },
  { tf: "1h", side: "Long", group: "Any swing high", c3: [1160, 306], c4: [271, 76] },
];

// Years covered by each period in these studies (build starts June 2010).
export const BUILD_YEARS = 11.6;
export const CHECK_YEARS = 3;
