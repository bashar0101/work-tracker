// Statistics for the summary cards and the PDF (PROJECT_PLAN.md §5).
// Nothing here reads the clock: callers pass `now` or a month.
// Results are plain numbers; components format them with `time.ts`.
//
// Rules:
// - Only completed sessions (WorkSession) count.
// - A session counts fully for the LOCAL date of its startTime. Never split.
// - Periods are compared by local date keys (`YYYY-MM-DD`), so DST changes
//   can't move a session into the wrong day, week, or month.

import { sortOldestFirst } from "./sessions";
import { startOfWeek, toDateKey, toMonthKey } from "./time";
import type { WorkSession } from "./types";

export interface TodayStats {
  totalMinutes: number;
  sessionCount: number;
}

export interface WeekStats {
  totalMinutes: number;
  workingDays: number;
  /** Rounded to the nearest minute. `null` when there are 0 working days. */
  averageMinutes: number | null;
}

export interface LongestDay {
  dateKey: string; // local `YYYY-MM-DD`
  totalMinutes: number;
}

export interface MonthStats extends WeekStats {
  /** The date with the highest daily total. `null` with no sessions. */
  longestDay: LongestDay | null;
}

/** Local date key of the session's start, or `null` for a bad timestamp. */
export function sessionDateKey(session: WorkSession): string | null {
  const start = new Date(session.startTime);
  if (Number.isNaN(start.getTime())) return null;
  return toDateKey(start);
}

function safeMinutes(minutes: number): number {
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/** Daily totals in minutes, keyed by local date key. Only matching days. */
export function totalsByDate(
  sessions: WorkSession[],
  include: (dateKey: string) => boolean = () => true,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const key = sessionDateKey(session);
    if (key === null || !include(key)) continue;
    totals.set(
      key,
      (totals.get(key) ?? 0) + safeMinutes(session.durationMinutes),
    );
  }
  return totals;
}

function summarize(totals: Map<string, number>): WeekStats {
  let totalMinutes = 0;
  for (const minutes of totals.values()) totalMinutes += minutes;
  const workingDays = totals.size;
  const averageMinutes =
    workingDays > 0 ? Math.round(totalMinutes / workingDays) : null;
  return { totalMinutes, workingDays, averageMinutes };
}

/** Today (the local date of `now`): total minutes and number of sessions. */
export function getTodayStats(
  sessions: WorkSession[],
  now: Date,
): TodayStats {
  const todayKey = toDateKey(now);
  let totalMinutes = 0;
  let sessionCount = 0;
  for (const session of sessions) {
    if (sessionDateKey(session) !== todayKey) continue;
    totalMinutes += safeMinutes(session.durationMinutes);
    sessionCount += 1;
  }
  return { totalMinutes, sessionCount };
}

/** The Monday–Sunday local week that contains `now`. */
export function getWeekStats(sessions: WorkSession[], now: Date): WeekStats {
  const monday = startOfWeek(now);
  const nextMonday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 7,
  );
  // `YYYY-MM-DD` keys sort like dates, so string comparison is safe.
  const fromKey = toDateKey(monday);
  const toKey = toDateKey(nextMonday);
  return summarize(
    totalsByDate(sessions, (key) => key >= fromKey && key < toKey),
  );
}

/**
 * The calendar month (local time) that contains `month`. Any date inside
 * the month works, so the PDF can report on a past month.
 *
 * Longest day: the date with the highest daily total (all of that day's
 * sessions added up). On a tie, the earlier date wins.
 */
export function getMonthStats(
  sessions: WorkSession[],
  month: Date,
): MonthStats {
  const monthKey = toMonthKey(month);
  const totals = totalsByDate(sessions, (key) => key.startsWith(`${monthKey}-`));

  let longestDay: LongestDay | null = null;
  for (const [dateKey, totalMinutes] of totals) {
    if (
      longestDay === null ||
      totalMinutes > longestDay.totalMinutes ||
      (totalMinutes === longestDay.totalMinutes && dateKey < longestDay.dateKey)
    ) {
      longestDay = { dateKey, totalMinutes };
    }
  }

  return { ...summarize(totals), longestDay };
}

/** A `Date` at local midnight from a `YYYY-MM-DD` key, or `null`. */
export function dateFromKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return toDateKey(date) === dateKey ? date : null;
}

/** Local `YYYY-MM` key of the session's start, or `null` for a bad timestamp. */
function sessionMonthKey(session: WorkSession): string | null {
  const key = sessionDateKey(session);
  return key === null ? null : key.slice(0, 7);
}

/**
 * Months (local `YYYY-MM` keys) with at least one completed session,
 * newest first, no duplicates. A session belongs to the month of its LOCAL
 * start date, so 00:30 on the 1st counts for the new month.
 */
export function getSessionMonths(sessions: WorkSession[]): string[] {
  const months = new Set<string>();
  for (const session of sessions) {
    const key = sessionMonthKey(session);
    if (key !== null) months.add(key);
  }
  // `YYYY-MM` keys sort like dates, so a reversed string sort is newest first.
  return [...months].sort().reverse();
}

/**
 * The month picker default (PROJECT_PLAN.md §7): the current month if it has
 * sessions, otherwise the latest month that has sessions. `null` when there
 * are no months. `months` must be newest first, as from `getSessionMonths`.
 */
export function getDefaultMonth(months: string[], now: Date): string | null {
  const current = toMonthKey(now);
  if (months.includes(current)) return current;
  return months[0] ?? null;
}

/** Sessions whose local start date is in the `YYYY-MM` month, oldest first. */
export function getSessionsInMonth(
  sessions: WorkSession[],
  monthKey: string,
): WorkSession[] {
  return sortOldestFirst(
    sessions.filter((session) => sessionMonthKey(session) === monthKey),
  );
}
