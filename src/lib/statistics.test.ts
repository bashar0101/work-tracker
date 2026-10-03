import { describe, expect, it } from "vitest";
import {
  dateFromKey,
  getDefaultMonth,
  getMonthEarnings,
  getMonthStats,
  getSessionMonths,
  getSessionsInMonth,
  getTodayEarnings,
  getTodayStats,
  getWeekEarnings,
  getWeekStats,
  totalsByDate,
} from "./statistics";
import type { WorkSession } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.
// 2026-10-03 is a Saturday. Its week is Mon 28 Sep – Sun 04 Oct.
const NOW = new Date(2026, 9, 3, 12, 0); // Sat 03 Oct 2026, 12:00 local

let nextId = 0;

/**
 * A completed session from local start parts and a duration in minutes.
 * Month is 0-based, like `new Date()`.
 */
function session(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  durationMinutes: number,
): WorkSession {
  const start = new Date(y, m, d, h, min);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  nextId += 1;
  return {
    id: `s${nextId}`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes,
  };
}

function expectNoNaN(value: object): void {
  for (const v of Object.values(value)) {
    if (typeof v === "number") expect(Number.isNaN(v)).toBe(false);
  }
}

describe("no sessions", () => {
  it("gives zero totals, 0 working days, a null average, and no NaN", () => {
    const today = getTodayStats([], NOW);
    const week = getWeekStats([], NOW);
    const month = getMonthStats([], NOW);

    expect(today).toEqual({ totalMinutes: 0, sessionCount: 0 });
    expect(week).toEqual({
      totalMinutes: 0,
      workingDays: 0,
      averageMinutes: null,
    });
    expect(month).toEqual({
      totalMinutes: 0,
      workingDays: 0,
      averageMinutes: null,
      longestDay: null,
    });
    expectNoNaN(today);
    expectNoNaN(week);
    expectNoNaN(month);
  });
});

describe("two sessions on one day", () => {
  const sessions = [
    session(2026, 9, 3, 9, 0, 180), // 3h
    session(2026, 9, 3, 13, 0, 245), // 4h 05m
  ];

  it("adds the totals and counts the sessions today", () => {
    expect(getTodayStats(sessions, NOW)).toEqual({
      totalMinutes: 425,
      sessionCount: 2,
    });
  });

  it("counts 1 working day in the week and month", () => {
    expect(getWeekStats(sessions, NOW)).toEqual({
      totalMinutes: 425,
      workingDays: 1,
      averageMinutes: 425,
    });
    const month = getMonthStats(sessions, NOW);
    expect(month.totalMinutes).toBe(425);
    expect(month.workingDays).toBe(1);
    expect(month.averageMinutes).toBe(425);
    expect(month.longestDay).toEqual({
      dateKey: "2026-10-03",
      totalMinutes: 425,
    });
  });
});

describe("weeks run Monday to Sunday", () => {
  const sunday = session(2026, 9, 4, 10, 0, 120); // Sun 04 Oct
  const monday = session(2026, 9, 5, 10, 0, 60); // Mon 05 Oct
  const sessions = [sunday, monday];

  it("puts a Sunday and the next Monday in different weeks", () => {
    const sundayWeek = getWeekStats(sessions, new Date(2026, 9, 4, 20, 0));
    expect(sundayWeek.totalMinutes).toBe(120);
    expect(sundayWeek.workingDays).toBe(1);

    const mondayWeek = getWeekStats(sessions, new Date(2026, 9, 5, 8, 0));
    expect(mondayWeek.totalMinutes).toBe(60);
    expect(mondayWeek.workingDays).toBe(1);
  });

  it("includes the Monday that starts the week, across a month boundary", () => {
    // Week of Sat 03 Oct starts on Mon 28 Sep.
    const week = getWeekStats(
      [
        session(2026, 8, 27, 10, 0, 30), // Sun 27 Sep: previous week
        session(2026, 8, 28, 0, 0, 60), // Mon 28 Sep 00:00
        session(2026, 9, 3, 9, 0, 90), // Sat 03 Oct
      ],
      NOW,
    );
    expect(week.totalMinutes).toBe(150);
    expect(week.workingDays).toBe(2);
  });
});

describe("a 23:00 to 07:00 session counts only for its start day", () => {
  it("counts for today on the start day, not on the next day", () => {
    const night = [session(2026, 9, 3, 23, 0, 480)]; // Sat 23:00 → Sun 07:00
    expect(getTodayStats(night, NOW)).toEqual({
      totalMinutes: 480,
      sessionCount: 1,
    });
    expect(getTodayStats(night, new Date(2026, 9, 4, 12, 0))).toEqual({
      totalMinutes: 0,
      sessionCount: 0,
    });
  });

  it("stays in the start week when it starts on a Sunday", () => {
    const night = [session(2026, 9, 4, 23, 0, 480)]; // Sun 23:00 → Mon 07:00
    expect(getWeekStats(night, new Date(2026, 9, 4, 23, 30)).totalMinutes).toBe(
      480,
    );
    const nextWeek = getWeekStats(night, new Date(2026, 9, 5, 12, 0));
    expect(nextWeek.totalMinutes).toBe(0);
    expect(nextWeek.workingDays).toBe(0);
    expect(nextWeek.averageMinutes).toBeNull();
  });

  it("stays in the start month when it starts on the last day of a month", () => {
    const night = [session(2026, 8, 30, 23, 0, 480)]; // 30 Sep 23:00 → 01 Oct 07:00
    const september = getMonthStats(night, new Date(2026, 8, 15));
    expect(september.totalMinutes).toBe(480);
    expect(september.workingDays).toBe(1);
    expect(september.longestDay).toEqual({
      dateKey: "2026-09-30",
      totalMinutes: 480,
    });

    const october = getMonthStats(night, NOW);
    expect(october.totalMinutes).toBe(0);
    expect(october.workingDays).toBe(0);
    expect(october.longestDay).toBeNull();
  });
});

describe("a session at 00:30 local time on the 1st", () => {
  const early = session(2026, 10, 1, 0, 30, 60); // 01 Nov 2026 00:30 local

  it("is still in the previous month in UTC", () => {
    expect(early.startTime.startsWith("2026-10-31T21:30")).toBe(true);
  });

  it("belongs to the new month", () => {
    const november = getMonthStats([early], new Date(2026, 10, 20));
    expect(november.totalMinutes).toBe(60);
    expect(november.workingDays).toBe(1);
    expect(november.longestDay?.dateKey).toBe("2026-11-01");

    expect(getMonthStats([early], new Date(2026, 9, 31)).totalMinutes).toBe(0);
  });

  it("belongs to today on the 1st", () => {
    expect(
      getTodayStats([early], new Date(2026, 10, 1, 9, 0)).sessionCount,
    ).toBe(1);
  });
});

describe("longest day", () => {
  it("uses the daily total, not the longest single session", () => {
    const sessions = [
      session(2026, 9, 1, 8, 0, 300), // 01 Oct: 5h
      session(2026, 9, 1, 14, 0, 300), // 01 Oct: 5h → 10h day
      session(2026, 9, 2, 8, 0, 540), // 02 Oct: one 9h session
    ];
    expect(getMonthStats(sessions, NOW).longestDay).toEqual({
      dateKey: "2026-10-01",
      totalMinutes: 600,
    });
  });

  it("picks the earlier date on a tie", () => {
    const sessions = [
      session(2026, 9, 2, 9, 0, 480), // listed first, but later date
      session(2026, 9, 1, 9, 0, 480),
    ];
    expect(getMonthStats(sessions, NOW).longestDay).toEqual({
      dateKey: "2026-10-01",
      totalMinutes: 480,
    });
  });
});

describe("daily average", () => {
  it("is total ÷ working days", () => {
    const sessions = [
      session(2026, 9, 1, 9, 0, 480),
      session(2026, 9, 2, 9, 0, 240),
      session(2026, 9, 2, 14, 0, 120),
    ];
    const month = getMonthStats(sessions, NOW);
    expect(month.totalMinutes).toBe(840);
    expect(month.workingDays).toBe(2);
    expect(month.averageMinutes).toBe(420);
  });

  it("rounds to the nearest minute", () => {
    const sessions = [
      session(2026, 9, 1, 9, 0, 60),
      session(2026, 9, 2, 9, 0, 61),
    ];
    // 121 / 2 = 60.5 → 61
    expect(getWeekStats(sessions, NOW).averageMinutes).toBe(61);

    const three = [
      session(2026, 9, 1, 9, 0, 100),
      session(2026, 9, 2, 9, 0, 100),
      session(2026, 9, 3, 9, 0, 101),
    ];
    // 301 / 3 = 100.33 → 100
    expect(getMonthStats(three, NOW).averageMinutes).toBe(100);
  });
});

describe("sessions outside the period", () => {
  const sessions = [
    session(2026, 8, 15, 9, 0, 100), // 15 Sep
    session(2026, 9, 2, 9, 0, 200), // 02 Oct (this week)
    session(2026, 9, 3, 9, 0, 300), // 03 Oct (today)
    session(2026, 9, 10, 9, 0, 400), // 10 Oct (next week)
    session(2025, 9, 3, 9, 0, 500), // 03 Oct 2025: same day, other year
  ];

  it("are excluded from today, week, and month", () => {
    expect(getTodayStats(sessions, NOW)).toEqual({
      totalMinutes: 300,
      sessionCount: 1,
    });
    expect(getWeekStats(sessions, NOW).totalMinutes).toBe(500);
    const month = getMonthStats(sessions, NOW);
    expect(month.totalMinutes).toBe(900);
    expect(month.workingDays).toBe(3);
  });
});

describe("bad data", () => {
  it("skips invalid timestamps and never gives NaN", () => {
    const bad: WorkSession = {
      id: "bad",
      startTime: "not a date",
      endTime: "not a date",
      durationMinutes: Number.NaN,
    };
    const month = getMonthStats([bad, session(2026, 9, 3, 9, 0, 60)], NOW);
    expect(month.totalMinutes).toBe(60);
    expect(month.workingDays).toBe(1);
    expectNoNaN(month);
    expectNoNaN(getTodayStats([bad], NOW));
  });
});

describe("helpers", () => {
  it("totalsByDate groups by local start date", () => {
    const totals = totalsByDate([
      session(2026, 9, 3, 0, 30, 10),
      session(2026, 9, 3, 23, 30, 20),
    ]);
    expect([...totals]).toEqual([["2026-10-03", 30]]);
  });

  it("dateFromKey gives local midnight, or null for a bad key", () => {
    const date = dateFromKey("2026-10-03");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(3);
    expect(date?.getHours()).toBe(0);
    expect(dateFromKey("2026-02-30")).toBeNull();
    expect(dateFromKey("nope")).toBeNull();
  });
});

describe("month picker helpers", () => {
  it("getSessionMonths lists only months with sessions, newest first, no duplicates", () => {
    const sessions = [
      session(2026, 7, 10, 9, 0, 60), // Aug 2026
      session(2026, 9, 1, 9, 0, 60), // Oct 2026
      session(2025, 11, 31, 9, 0, 60), // Dec 2025
      session(2026, 9, 3, 9, 0, 60), // Oct 2026 again
      session(2026, 7, 20, 9, 0, 60), // Aug 2026 again
    ];
    expect(getSessionMonths(sessions)).toEqual([
      "2026-10",
      "2026-08",
      "2025-12",
    ]);
  });

  it("getSessionMonths uses the local start date: 00:30 on the 1st is the new month", () => {
    // 01 Oct 2026 00:30 in Istanbul is 30 Sep 2026 21:30 UTC.
    const s = session(2026, 9, 1, 0, 30, 60);
    expect(s.startTime.startsWith("2026-09-30")).toBe(true);
    expect(getSessionMonths([s])).toEqual(["2026-10"]);
    expect(getSessionsInMonth([s], "2026-10")).toEqual([s]);
    expect(getSessionsInMonth([s], "2026-09")).toEqual([]);
  });

  it("getSessionMonths skips bad timestamps and handles no sessions", () => {
    const bad: WorkSession = {
      id: "bad",
      startTime: "nope",
      endTime: "nope",
      durationMinutes: 0,
    };
    expect(getSessionMonths([])).toEqual([]);
    expect(getSessionMonths([bad])).toEqual([]);
  });

  it("getDefaultMonth picks the current month when it has sessions", () => {
    expect(getDefaultMonth(["2026-11", "2026-10", "2026-08"], NOW)).toBe(
      "2026-10",
    );
  });

  it("getDefaultMonth picks the latest month when the current one has none", () => {
    expect(getDefaultMonth(["2026-08", "2025-12"], NOW)).toBe("2026-08");
  });

  it("getDefaultMonth gives null for no months", () => {
    expect(getDefaultMonth([], NOW)).toBeNull();
  });

  it("getSessionsInMonth keeps only that month, oldest first", () => {
    const a = session(2026, 9, 3, 9, 0, 60);
    const b = session(2026, 9, 1, 22, 0, 480);
    const c = session(2026, 8, 30, 9, 0, 60); // September
    const d = session(2026, 9, 31, 23, 30, 60); // last day of October
    const input = [a, c, d, b];
    expect(getSessionsInMonth(input, "2026-10")).toEqual([b, a, d]);
    expect(getSessionsInMonth(input, "2026-09")).toEqual([c]);
    expect(getSessionsInMonth(input, "2026-07")).toEqual([]);
    expect(getSessionsInMonth([], "2026-10")).toEqual([]);
    // The input is not changed.
    expect(input).toEqual([a, c, d, b]);
  });
});

describe("earnings per period (§9)", () => {
  // NOW is Sat 03 Oct 2026. Week: Mon 28 Sep – Sun 04 Oct.
  it("is null with no sessions or no rate at all", () => {
    expect(getTodayEarnings([], NOW, 25)).toBeNull();
    expect(getWeekEarnings([], NOW, 25)).toBeNull();
    expect(getMonthEarnings([], NOW, 25)).toBeNull();
    const sessions = [session(2026, 9, 3, 9, 0, 60)];
    expect(getTodayEarnings(sessions, NOW, null)).toBeNull();
    expect(getWeekEarnings(sessions, NOW, null)).toBeNull();
    expect(getMonthEarnings(sessions, NOW, null)).toBeNull();
  });

  it("uses the same periods as the stats", () => {
    const sessions = [
      { ...session(2026, 9, 3, 9, 0, 60), hourlyRate: 10 }, // today: 10.00
      { ...session(2026, 8, 28, 9, 0, 60), hourlyRate: 20 }, // Mon, Sep: 20.00
      { ...session(2026, 9, 1, 9, 0, 30), hourlyRate: 40 }, // Thu: 20.00
      { ...session(2026, 9, 5, 9, 0, 60), hourlyRate: 100 }, // next week
      { ...session(2026, 8, 27, 9, 0, 60), hourlyRate: 100 }, // last Sun
    ];
    expect(getTodayEarnings(sessions, NOW, null)).toBe(1000);
    expect(getWeekEarnings(sessions, NOW, null)).toBe(1000 + 2000 + 2000);
    expect(getMonthEarnings(sessions, NOW, null)).toBe(1000 + 2000 + 10000);
  });

  it("counts a night shift for its start day", () => {
    const night = { ...session(2026, 9, 2, 23, 0, 480), hourlyRate: 10 };
    expect(getTodayEarnings([night], NOW, null)).toBeNull();
    expect(getTodayEarnings([night], new Date(2026, 9, 2, 12), null)).toBe(
      8000,
    );
  });

  it("mixes stored rates, the current rate, and no rate", () => {
    const sessions = [
      { ...session(2026, 9, 3, 8, 0, 60), hourlyRate: 20 },
      session(2026, 9, 3, 10, 0, 60), // no stored rate
    ];
    // No current rate: only the session with a stored rate counts.
    expect(getTodayEarnings(sessions, NOW, null)).toBe(2000);
    // A current rate applies to the session without one.
    expect(getTodayEarnings(sessions, NOW, 50)).toBe(7000);
  });
});
