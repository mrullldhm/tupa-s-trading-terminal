// Use an explicit display zone, independent of the browser/OS timezone. Real timestamps remain UTC instants.
export const DISPLAY_TIME_ZONE = "Asia/Kuala_Lumpur";
const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const hour = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "short" });
const month = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, month: "short" });
const year = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, year: "numeric" });

export function malaysiaTimestamp(seconds: number): string {
  const parts = Object.fromEntries(stamp.formatToParts(new Date(seconds * 1000)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// Lightweight Charts TickMarkType: Year=0, Month=1, DayOfMonth=2, Time=3, TimeWithSeconds=4.
export function malaysiaTick(seconds: number, type: number): string {
  const date = new Date(seconds * 1000);
  return (type === 0 ? year : type === 1 ? month : type === 2 ? shortDay : hour).format(date);
}
