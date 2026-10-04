// Date keys, period starts, and formatters (PROJECT_PLAN.md §4).
// All dates use the device's local time. Nothing here reads the clock.
// Output is always English with digits 0-9: no locale-dependent APIs.

/** Shown when there is no value, e.g. the average with 0 working days. */
export const NO_VALUE = "-";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local date key `YYYY-MM-DD`. Never uses the UTC date. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local month key `YYYY-MM`. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** 00:00 local time on the same day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday 00:00 local time of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  // getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysSinceMonday,
  );
}

/** The 1st of the month, 00:00 local time. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Number of days in the month that contains `date`: 28 to 31. */
export function daysInMonth(date: Date): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** `DD Mon YYYY`, e.g. `03 Oct 2026`. */
export function formatDate(date: Date): string {
  return `${pad2(date.getDate())} ${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`;
}

/** `HH:mm`, 24-hour, e.g. `09:05`. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Number of local calendar days from `start` to `end`. DST-safe. */
function calendarDaysBetween(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * End time for the UI and PDF: `HH:mm`, or `HH:mm (+N)` when the end
 * falls N local days after the start, e.g. `06:00 (+1)`.
 */
export function formatEndTime(start: Date, end: Date): string {
  const time = formatTime(end);
  const days = calendarDaysBetween(start, end);
  return days > 0 ? `${time} (+${days})` : time;
}

/** Duration from minutes: `8h 05m`, `0h 00m`, `126h 40m`. Never NaN. */
export function formatDuration(minutes: number): string {
  const total =
    Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${pad2(mins)}m`;
}

/** Live timer from milliseconds: `HH:MM:SS`. Hours can go past 24. */
export function formatTimer(ms: number): string {
  const totalSeconds =
    Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/** Date in CSV files: local `YYYY-MM-DD`. */
export function formatCsvDate(date: Date): string {
  return toDateKey(date);
}

/** `Month YYYY`, e.g. `October 2026`. */
export function formatMonth(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * `Month YYYY` from a `YYYY-MM` key, e.g. `2026-10` → `October 2026`.
 * Returns NO_VALUE for an invalid key.
 */
export function formatMonthKey(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return NO_VALUE;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return NO_VALUE;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}
