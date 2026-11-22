export interface ChartIndicator {
  name: string;
  pane: string;
  color: string;
  stepped: boolean;
  values: (number | null)[];
}

export interface SwingZigzag {
  name: string;
  color: string;
  points: [time: number, price: number][];
}

interface ChartData {
  symbol: string;
  version: string;
  signalTf: string;
  views: {
    tf: string;
    candles: [time: number, open: number, high: number, low: number, close: number, volume: number, end: number][];
    indicators: ChartIndicator[];
    swing?: SwingZigzag;
    retrospectiveSwing?: SwingZigzag;
  }[];
}

export interface SetupChart extends ChartData {
  trade: {
    side: 1 | -1;
    qty: number;
    signalOpen: number;
    signalTime: number;
    fillTime: number;
    exitTime: number;
    limit: number;
    entry: number;
    stop: number;
    target: number | null;
    exit: number;
    managedStop: boolean;
    riskTicks: number;
    net: number;
    reason: string;
    partial?: { time: number; price: number; qty: number };
  };
  reaction?: {
    bandLow: number;
    bandHigh: number;
    wick: number;
    score: number;
    minScore: number;
    touches: number;
    closeStrength: number;
    minCloseStrength: number;
  };
}

export interface PatternChart extends ChartData {
  pattern: {
    side: 1 | -1;
    candle1: number;
    candle2: number;
    candle3: number;
    candle3Close: number | null;
    confirmed: number;
    confirmationBar?: number;
    confirmationMethod: "sweep" | "swing-close" | "retest";
    confirmationPrice: number | null;
    earlySweep: number | null;
    candle1Close: number;
    catalystTf: string;
    catalyst: number;
    catalystEnd: number;
    catalystSwing: number;
    catalystSwingPrice?: number;
    firstTouch: number;
    secondTouch: number;
    retest: number;
    level: number;
    referenceTf: string;
    reference: number;
    referenceLevel: number;
    crossesRoll: boolean;
  };
}

export type HistoricalChart = SetupChart | PatternChart;

const TIMEFRAME_LABELS: Record<string, string> = {
  "1m": "1-minute", "5m": "5-minute", "15m": "15-minute", "30m": "30-minute",
  "1h": "1-hour", "4h": "4-hour", "1d": "Daily",
};
export const timeframeLabel = (tf: string) => TIMEFRAME_LABELS[tf] ?? tf;

export const marketClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const marketDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "numeric",
  month: "short",
  year: "numeric",
});
