import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_TARGETS,
  dailyTargetMinutes,
  formatOptionalDuration,
  formatPace,
  formatPercent,
  getMonthPace,
  getProgress,
  monthlyTargetMinutes,
  parseDailyHoursInput,
  parseDaysOffInput,
  weeklyTargetMinutes,
  type MonthPace,
} from "./progress";
import type { WorkSession, WorkTargets } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.
// October 2026 has 31 days. Default monthly target: 29 × 10h = 290h = 17400m.
const TARGETS = DEFAULT_WORK_TARGETS;
const OCT_TARGET = 17_400;

let nextId = 0;

/** A completed session. Month is 0-based, like `new Date()`. */
function session(
  y: number,
  m: number,
  d: number,
  h: number,
  durationMinutes: number,
): WorkSession {
  const start = new Date(y, m, d, h, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  nextId += 1;
  return {
    id: `p${nextId}`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes,
  };
}

/** One session of `minutes` on each listed October day. */
function octoberDays(days: number[], minutes = 600): WorkSession[] {
  return days.map((d) => session(2026, 9, d, 8, minutes));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function expectNoNaN(pace: MonthPace): void {
  for (const value of Object.values(pace)) {
    if (typeof value === "number") expect(Number.isNaN(value)).toBe(false);
  }
}

describe("targets", () => {
  it("defaults to 10 hours a day and 2 days off", () => {
    expect(TARGETS).toEqual({ dailyHours: 10, daysOffPerMonth: 2 });
    expect(dailyTargetMinutes(TARGETS)).toBe(600);
  });

  it("weekly target is 7 × daily: 70h with defaults", () => {
    expect(weeklyTargetMinutes(TARGETS)).toBe(70 * 60);
  });

  it("monthly target follows the month length", () => {
    expect(monthlyTargetMinutes(TARGETS, new Date(2026, 1, 10))).toBe(260 * 60); // 28 days
    expect(monthlyTargetMinutes(TARGETS, new Date(2028, 1, 10))).toBe(270 * 60); // 29, leap
    expect(monthlyTargetMinutes(TARGETS, new Date(2026, 3, 10))).toBe(280 * 60); // 30 days
    expect(monthlyTargetMinutes(TARGETS, new Date(2026, 9, 10))).toBe(290 * 60); // 31 days
  });

  it("uses custom targets", () => {
    const custom: WorkTargets = { dailyHours: 8.5, daysOffPerMonth: 4 };
    expect(dailyTargetMinutes(custom)).toBe(510);
    expect(weeklyTargetMinutes(custom)).toBe(7 * 510);
    // October: (31 − 4) × 510
    expect(monthlyTargetMinutes(custom, new Date(2026, 9, 1))).toBe(27 * 510);
  });
});

describe("getProgress", () => {
  it("gives percent and time left", () => {
    expect(getProgress(300, 600)).toEqual({
      workedMinutes: 300,
      targetMinutes: 600,
      remainingMinutes: 300,
      percent: 50,
    });
  });

  it("goes above 100% and never leaves negative time", () => {
    const progress = getProgress(900, 600);
    expect(progress.percent).toBe(150);
    expect(progress.remainingMinutes).toBe(0);
  });

  it("gives a null percent for a target of 0", () => {
    expect(getProgress(120, 0).percent).toBeNull();
  });

  it("treats bad input as 0, never NaN", () => {
    expect(getProgress(Number.NaN, 600)).toEqual({
      workedMinutes: 0,
      targetMinutes: 600,
      remainingMinutes: 600,
      percent: 0,
    });
  });
});

describe("getMonthPace", () => {
  it("on the 1st with no work: expected 0, on track, no projection", () => {
    const pace = getMonthPace([], new Date(2026, 9, 1, 9, 0), TARGETS);
    expect(pace).toEqual({
      targetMinutes: OCT_TARGET,
      workedMinutes: 0,
      expectedMinutes: 0,
      differenceMinutes: 0,
      status: "on-track",
      neededPerDayMinutes: 600, // 17400 ÷ 29 work days
      projectedMinutes: null,
      daysOffAllowed: 2,
      daysOffUsed: 0,
      daysOffLeft: 2,
      missedDays: 0,
      workDaysLeft: 29, // 31 days − 2 days off left
    });
    expectNoNaN(pace);
  });

  it("never counts today as a day off", () => {
    // Worked the 1st; nothing yet on the 2nd (today).
    const pace = getMonthPace(octoberDays([1]), new Date(2026, 9, 2, 9, 0), TARGETS);
    expect(pace.daysOffUsed).toBe(0);
    expect(pace.daysOffLeft).toBe(2);
    expect(pace.status).toBe("on-track");
  });

  it("one empty past day is a day off: 1 used, 1 left, 0 missed", () => {
    // Today is the 5th. Worked the 1st, 2nd, 4th; the 3rd is empty.
    const pace = getMonthPace(
      octoberDays([1, 2, 4]),
      new Date(2026, 9, 5, 9, 0),
      TARGETS,
    );
    expect(pace.daysOffUsed).toBe(1);
    expect(pace.daysOffLeft).toBe(1);
    expect(pace.missedDays).toBe(0);
    expect(pace.expectedMinutes).toBe(1800); // (4 past − 1 off) × 600
    expect(pace.workedMinutes).toBe(1800);
    expect(pace.status).toBe("on-track");
    expect(pace.workDaysLeft).toBe(26); // 27 days left − 1 day off left
    expect(pace.neededPerDayMinutes).toBe(600); // (17400 − 1800) ÷ 26
    expect(pace.projectedMinutes).toBe(OCT_TARGET); // 1800 + 600 × 26
  });

  it("three empty past days: 2 used, 0 left, 1 missed, behind", () => {
    // Today is the 5th. Only the 4th was worked.
    const pace = getMonthPace(octoberDays([4]), new Date(2026, 9, 5, 9, 0), TARGETS);
    expect(pace.daysOffUsed).toBe(2);
    expect(pace.daysOffLeft).toBe(0);
    expect(pace.missedDays).toBe(1);
    expect(pace.expectedMinutes).toBe(1200); // (4 − 2) × 600
    expect(pace.differenceMinutes).toBe(-600);
    expect(pace.status).toBe("behind");
    expect(pace.workDaysLeft).toBe(27);
    // (17400 − 600) ÷ 27 = 622.2… → rounded up
    expect(pace.neededPerDayMinutes).toBe(623);
    // 600 + (600 ÷ 2) × 27
    expect(pace.projectedMinutes).toBe(8700);
  });

  it("counts work done today: ahead", () => {
    const pace = getMonthPace(
      [...octoberDays([1]), session(2026, 9, 2, 8, 600)],
      new Date(2026, 9, 2, 19, 0),
      TARGETS,
    );
    expect(pace.expectedMinutes).toBe(600);
    expect(pace.differenceMinutes).toBe(600);
    expect(pace.status).toBe("ahead");
  });

  it("is on track within ±30 minutes", () => {
    const now = new Date(2026, 9, 2, 19, 0);
    const at = (minutesOnFirst: number) =>
      getMonthPace(octoberDays([1], minutesOnFirst), now, TARGETS).status;
    expect(at(630)).toBe("on-track");
    expect(at(631)).toBe("ahead");
    expect(at(570)).toBe("on-track");
    expect(at(569)).toBe("behind");
  });

  it("treats a 0-minute day as a day off", () => {
    const pace = getMonthPace(
      [...octoberDays([1], 0), ...octoberDays([2])],
      new Date(2026, 9, 3, 9, 0),
      TARGETS,
    );
    expect(pace.daysOffUsed).toBe(1);
  });

  it("needs 0h 00m per day once the target is reached", () => {
    // 29 days × 10h = 290h by the 30th.
    const pace = getMonthPace(
      octoberDays(range(1, 29)),
      new Date(2026, 9, 30, 9, 0),
      TARGETS,
    );
    expect(pace.workedMinutes).toBe(OCT_TARGET);
    expect(pace.neededPerDayMinutes).toBe(0);
  });

  it("gives no needed-per-day when no work days are left", () => {
    // The 31st, 2 days off left, 1 day left → 0 work days left; 40h missing.
    const pace = getMonthPace(
      octoberDays(range(1, 30), 500),
      new Date(2026, 9, 31, 9, 0),
      TARGETS,
    );
    expect(pace.workDaysLeft).toBe(0);
    expect(pace.neededPerDayMinutes).toBeNull();
    expectNoNaN(pace);
  });

  it("only counts sessions that start in this month", () => {
    // Starts 30 Sep 23:00 and runs into October: belongs to September.
    const pace = getMonthPace(
      [session(2026, 8, 30, 23, 600)],
      new Date(2026, 9, 1, 12, 0),
      TARGETS,
    );
    expect(pace.workedMinutes).toBe(0);
  });

  it("uses the month length: February 2026 has 28 days", () => {
    const pace = getMonthPace([], new Date(2026, 1, 1, 9, 0), TARGETS);
    expect(pace.targetMinutes).toBe(260 * 60);
    expect(pace.workDaysLeft).toBe(26);
  });
});

describe("formatters", () => {
  it("formatPercent", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(112)).toBe("112%");
    expect(formatPercent(null)).toBe("-");
    expect(formatPercent(Number.NaN)).toBe("-");
  });

  it("formatOptionalDuration", () => {
    expect(formatOptionalDuration(623)).toBe("10h 23m");
    expect(formatOptionalDuration(0)).toBe("0h 00m");
    expect(formatOptionalDuration(null)).toBe("-");
  });

  it("formatPace", () => {
    expect(formatPace({ status: "on-track", differenceMinutes: 12 })).toBe(
      "On track",
    );
    expect(formatPace({ status: "ahead", differenceMinutes: 270 })).toBe(
      "Ahead by 4h 30m",
    );
    expect(formatPace({ status: "behind", differenceMinutes: -270 })).toBe(
      "Behind by 4h 30m",
    );
  });
});

describe("input parsers", () => {
  it("parseDailyHoursInput accepts hours with up to 2 decimals", () => {
    expect(parseDailyHoursInput("10")).toBe(10);
    expect(parseDailyHoursInput(" 8.5 ")).toBe(8.5);
    expect(parseDailyHoursInput("8,25")).toBe(8.25);
    expect(parseDailyHoursInput("24")).toBe(24);
  });

  it("parseDailyHoursInput rejects bad values", () => {
    for (const text of ["", "0", "0.00", "24.01", "25", "-1", "8.555", "abc", "1e1"]) {
      expect(parseDailyHoursInput(text)).toBeNull();
    }
  });

  it("parseDaysOffInput accepts whole numbers 0 to 10", () => {
    expect(parseDaysOffInput("0")).toBe(0);
    expect(parseDaysOffInput(" 2 ")).toBe(2);
    expect(parseDaysOffInput("10")).toBe(10);
  });

  it("parseDaysOffInput rejects bad values", () => {
    for (const text of ["", "11", "-1", "1.5", "two"]) {
      expect(parseDaysOffInput(text)).toBeNull();
    }
  });
});
