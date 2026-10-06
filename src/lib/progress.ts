// Hour targets, progress, and pace (PROJECT_PLAN.md §10).
// Nothing here reads the clock: callers pass `now`.
// Results are plain numbers in minutes; the formatters at the bottom turn
// them into text with the §4 formats.
//
// Rules:
// - Worked time is the same as in §5: completed sessions, counted fully
//   for the local date of their start.
// - Days off are automatic: a past day of the month with no work time is a
//   day off, up to the monthly allowance. More empty days are "missed".
// - Today is still in progress: it is never a day off and is not expected yet.

import { MESSAGES, type Locale } from "./i18n";
import { totalsByDate } from "./statistics";
import {
  daysInMonth,
  formatDuration,
  NO_VALUE,
  toDateKey,
  toMonthKey,
} from "./time";
import type { WorkSession, WorkTargets } from "./types";

/** 10 hours a day, 2 days off a month. */
export const DEFAULT_WORK_TARGETS: WorkTargets = {
  dailyHours: 10,
  daysOffPerMonth: 2,
};

export const MAX_DAILY_HOURS = 24;
export const MAX_DAYS_OFF = 10;

/** Within this many minutes of "expected by now" counts as on track. */
export const ON_TRACK_MINUTES = 30;

/** A finite number of hours, more than 0 and at most MAX_DAILY_HOURS. */
export function isDailyHours(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_DAILY_HOURS
  );
}

/** A whole number of days off, 0 to MAX_DAYS_OFF. */
export function isDaysOff(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_DAYS_OFF
  );
}

function safeMinutes(minutes: number): number {
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/** The daily target in whole minutes, e.g. 10h → 600, 8.5h → 510. */
export function dailyTargetMinutes(targets: WorkTargets): number {
  return Math.round(targets.dailyHours * 60);
}

/** Always 7 × the daily target. Days off don't lower it. */
export function weeklyTargetMinutes(targets: WorkTargets): number {
  return 7 * dailyTargetMinutes(targets);
}

/**
 * (days in the month − days off) × daily target, for the month that
 * contains `month`. With defaults: 28 days → 260h, 30 → 280h, 31 → 290h.
 */
export function monthlyTargetMinutes(
  targets: WorkTargets,
  month: Date,
): number {
  const workDays = Math.max(0, daysInMonth(month) - targets.daysOffPerMonth);
  return workDays * dailyTargetMinutes(targets);
}

export interface Progress {
  workedMinutes: number;
  targetMinutes: number;
  /** Target − worked, never below 0. */
  remainingMinutes: number;
  /** Rounded; can go above 100. `null` when the target is 0. */
  percent: number | null;
}

/** Worked time against a target. Bad input counts as 0, never NaN. */
export function getProgress(
  workedMinutes: number,
  targetMinutes: number,
): Progress {
  const worked = safeMinutes(workedMinutes);
  const target = safeMinutes(targetMinutes);
  return {
    workedMinutes: worked,
    targetMinutes: target,
    remainingMinutes: Math.max(0, target - worked),
    percent: target > 0 ? Math.round((worked / target) * 100) : null,
  };
}

export type PaceStatus = "ahead" | "on-track" | "behind";

export interface MonthPace {
  targetMinutes: number;
  /** All work in the month so far, today included. */
  workedMinutes: number;
  /** (past days − days off used) × daily target. */
  expectedMinutes: number;
  /** Worked − expected. Negative when behind. */
  differenceMinutes: number;
  status: PaceStatus;
  /** Rounded up. 0 when the target is reached; `null` when no work days are left. */
  neededPerDayMinutes: number | null;
  /** Expected month total at the current speed. `null` with 0 past work days. */
  projectedMinutes: number | null;
  daysOffAllowed: number;
  daysOffUsed: number;
  daysOffLeft: number;
  /** Empty past days beyond the allowance. */
  missedDays: number;
  /** Today to month end (today included), minus days off left. */
  workDaysLeft: number;
}

/** Pace analysis for the calendar month that contains `now` (§10). */
export function getMonthPace(
  sessions: WorkSession[],
  now: Date,
  targets: WorkTargets,
): MonthPace {
  const daily = dailyTargetMinutes(targets);
  const target = monthlyTargetMinutes(targets, now);
  const prefix = `${toMonthKey(now)}-`;
  const totals = totalsByDate(sessions, (key) => key.startsWith(prefix));

  let workedMinutes = 0;
  for (const minutes of totals.values()) workedMinutes += minutes;

  // Past days: the 1st up to yesterday. Today is still in progress.
  const pastDays = now.getDate() - 1;
  let pastWorked = 0;
  let emptyPastDays = 0;
  for (let day = 1; day <= pastDays; day += 1) {
    const key = toDateKey(new Date(now.getFullYear(), now.getMonth(), day));
    const minutes = totals.get(key) ?? 0;
    pastWorked += minutes;
    if (minutes === 0) emptyPastDays += 1;
  }

  const daysOffAllowed = targets.daysOffPerMonth;
  const daysOffUsed = Math.min(emptyPastDays, daysOffAllowed);
  const daysOffLeft = daysOffAllowed - daysOffUsed;
  const missedDays = emptyPastDays - daysOffUsed;

  const pastWorkDays = pastDays - daysOffUsed;
  const expectedMinutes = pastWorkDays * daily;
  const differenceMinutes = workedMinutes - expectedMinutes;
  let status: PaceStatus = "on-track";
  if (differenceMinutes > ON_TRACK_MINUTES) status = "ahead";
  else if (differenceMinutes < -ON_TRACK_MINUTES) status = "behind";

  const daysLeft = daysInMonth(now) - pastDays;
  const workDaysLeft = Math.max(0, daysLeft - daysOffLeft);

  const missing = Math.max(0, target - workedMinutes);
  let neededPerDayMinutes: number | null = null;
  if (missing === 0) neededPerDayMinutes = 0;
  else if (workDaysLeft > 0) {
    neededPerDayMinutes = Math.ceil(missing / workDaysLeft);
  }

  // Past average per work day, carried over the work days that are left.
  // Today's work is already in `workedMinutes`, so never project less.
  const projectedMinutes =
    pastWorkDays > 0
      ? Math.max(
          workedMinutes,
          Math.round(pastWorked + (pastWorked / pastWorkDays) * workDaysLeft),
        )
      : null;

  return {
    targetMinutes: target,
    workedMinutes,
    expectedMinutes,
    differenceMinutes,
    status,
    neededPerDayMinutes,
    projectedMinutes,
    daysOffAllowed,
    daysOffUsed,
    daysOffLeft,
    missedDays,
    workDaysLeft,
  };
}

/** `85%`, `112%`, or `-` when there is no percent. */
export function formatPercent(percent: number | null): string {
  return percent === null || !Number.isFinite(percent)
    ? NO_VALUE
    : `${percent}%`;
}

/** A duration, or `-` when there is none. */
export function formatOptionalDuration(
  minutes: number | null,
  locale: Locale = "en",
): string {
  return minutes === null ? NO_VALUE : formatDuration(minutes, locale);
}

/** `On track`, `Ahead by 4h 30m`, or `Behind by 4h 30m` (or Arabic). */
export function formatPace(
  pace: Pick<MonthPace, "status" | "differenceMinutes">,
  locale: Locale = "en",
): string {
  const m = MESSAGES[locale].progress;
  if (pace.status === "on-track") return m.onTrack;
  const duration = formatDuration(Math.abs(pace.differenceMinutes), locale);
  return pace.status === "ahead" ? m.aheadBy(duration) : m.behindBy(duration);
}

/**
 * The "Hours per day" input as hours, or `null` when invalid. Accepts
 * `10`, `8.5`, `8.25`, and a comma decimal like `8,5`. Rejects 0, more
 * than 2 decimals, values above MAX_DAILY_HOURS, and text.
 */
export function parseDailyHoursInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const hours = Number(trimmed.replace(",", "."));
  return isDailyHours(hours) ? hours : null;
}

/** The "Days off per month" input, or `null` when invalid: 0 to MAX_DAYS_OFF. */
export function parseDaysOffInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return isDaysOff(days) ? days : null;
}
