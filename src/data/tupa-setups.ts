export const TUPA_PATH = "/strategies/tupa-1/";
export const TUPA_SETUPS_PATH = TUPA_PATH + "setups/";

export const TUPA_GROUPS = [
  { id: "4h-1h-early", source: "4h-1h-inside", method: "sweep", pair: "4H–1H", label: "Early catalyst sweep", long: 12, short: 11 },
  { id: "4h-1h-close", source: "4h-1h-inside", method: "swing-close", pair: "4H–1H", label: "Confirmed at candle 3 close", long: 29, short: 31 },
  { id: "4h-1h-after", source: "4h-1h-after", method: "retest", pair: "4H–1H", label: "Retest after candle 3 closed", long: 11, short: 25 },
  { id: "1h-15m-early", source: "1h-15m-inside", method: "sweep", pair: "1H–15m", label: "Early catalyst sweep", long: 85, short: 78 },
  { id: "1h-15m-close", source: "1h-15m-inside", method: "swing-close", pair: "1H–15m", label: "Confirmed at candle 3 close", long: 239, short: 240 },
  { id: "1h-15m-after", source: "1h-15m-after", method: "retest", pair: "1H–15m", label: "Retest after candle 3 closed", long: 102, short: 110 },
] as const;

export type TupaSetupGroup = typeof TUPA_GROUPS[number];
export type TupaGroup = TupaSetupGroup["id"];
