import { describe, expect, it } from "vitest";
import {
  NO_VALUE,
  formatCsvDate,
  formatDate,
  formatDuration,
  formatEndTime,
  formatMonth,
  formatMonthKey,
  formatTime,
  formatTimer,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toMonthKey,
} from "@/lib/time";

const HOUR_MS = 3_600_000;

describe("test setup", () => {
  it("runs in Europe/Istanbul (UTC+3), not UTC", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-180);
  });
});

describe("toDateKey", () => {
  it("builds a zero-padded local date key", () => {
    expect(toDateKey(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("gives 00:30 local time that day's key, not the UTC day before", () => {
    const date = new Date(2026, 9, 3, 0, 30);
    // In UTC this is still 2 Oct, which is the bug we guard against.
    expect(date.toISOString().slice(0, 10)).toBe("2026-10-02");
    expect(toDateKey(date)).toBe("2026-10-03");
  });

  it("keeps 23:59 local time on the same day", () => {
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("toMonthKey", () => {
  it("builds a zero-padded local month key", () => {
    expect(toMonthKey(new Date(2026, 2, 15))).toBe("2026-03");
  });

  it("puts 00:30 on the 1st in the new month", () => {
    const date = new Date(2026, 10, 1, 0, 30);
    expect(toMonthKey(date)).toBe("2026-11");
  });
});

describe("startOfDay", () => {
  it("returns 00:00 local time on the same day", () => {
    const result = startOfDay(new Date(2026, 9, 3, 15, 45, 30, 500));
    expect(result).toEqual(new Date(2026, 9, 3, 0, 0, 0, 0));
  });

  it("does not change the input", () => {
    const input = new Date(2026, 9, 3, 15, 45);
    startOfDay(input);
    expect(input).toEqual(new Date(2026, 9, 3, 15, 45));
  });
});

describe("startOfWeek", () => {
  it("returns the same day for a Monday", () => {
    expect(startOfWeek(new Date(2026, 8, 28, 10, 0))).toEqual(
      new Date(2026, 8, 28),
    );
  });

  it("returns the Monday before for a Wednesday", () => {
    expect(startOfWeek(new Date(2026, 8, 30, 10, 0))).toEqual(
      new Date(2026, 8, 28),
    );
  });

  it("puts a Sunday in the week that started on the Monday before", () => {
    const sunday = new Date(2026, 9, 4, 23, 30); // Sun 4 Oct 2026
    expect(sunday.getDay()).toBe(0);
    expect(startOfWeek(sunday)).toEqual(new Date(2026, 8, 28)); // Mon 28 Sep
  });

  it("starts a new week on the Monday after that Sunday", () => {
    expect(startOfWeek(new Date(2026, 9, 5, 0, 30))).toEqual(
      new Date(2026, 9, 5),
    );
  });

  it("crosses a year boundary", () => {
    // Fri 1 Jan 2027 → Mon 28 Dec 2026
    expect(startOfWeek(new Date(2027, 0, 1, 9, 0))).toEqual(
      new Date(2026, 11, 28),
    );
  });
});

describe("startOfMonth", () => {
  it("returns the 1st at 00:00 local time", () => {
    expect(startOfMonth(new Date(2026, 9, 31, 23, 59))).toEqual(
      new Date(2026, 9, 1),
    );
  });
});

describe("formatDate", () => {
  it("formats as DD Mon YYYY", () => {
    expect(formatDate(new Date(2026, 9, 3, 12, 0))).toBe("03 Oct 2026");
  });

  it("uses the local date at 00:30", () => {
    expect(formatDate(new Date(2026, 0, 1, 0, 30))).toBe("01 Jan 2026");
  });

  it("formats December", () => {
    expect(formatDate(new Date(2026, 11, 25))).toBe("25 Dec 2026");
  });
});

describe("formatTime", () => {
  it("formats as zero-padded 24-hour HH:mm", () => {
    expect(formatTime(new Date(2026, 9, 3, 9, 5))).toBe("09:05");
    expect(formatTime(new Date(2026, 9, 3, 0, 0))).toBe("00:00");
    expect(formatTime(new Date(2026, 9, 3, 23, 59))).toBe("23:59");
  });
});

describe("formatEndTime", () => {
  it("shows plain HH:mm when the session ends on the same day", () => {
    const start = new Date(2026, 9, 2, 9, 0);
    const end = new Date(2026, 9, 2, 17, 30);
    expect(formatEndTime(start, end)).toBe("17:30");
  });

  it("adds (+1) for a 22:00 to 06:00 night shift", () => {
    const start = new Date(2026, 9, 3, 22, 0);
    const end = new Date(2026, 9, 4, 6, 0);
    expect(formatEndTime(start, end)).toBe("06:00 (+1)");
  });

  it("adds (+1) when ending exactly at midnight", () => {
    const start = new Date(2026, 9, 3, 20, 0);
    const end = new Date(2026, 9, 4, 0, 0);
    expect(formatEndTime(start, end)).toBe("00:00 (+1)");
  });

  it("counts several days", () => {
    const start = new Date(2026, 9, 3, 8, 0);
    const end = new Date(2026, 9, 5, 9, 15);
    expect(formatEndTime(start, end)).toBe("09:15 (+2)");
  });

  it("counts calendar days across a month end", () => {
    const start = new Date(2026, 9, 31, 22, 0);
    const end = new Date(2026, 10, 1, 6, 0);
    expect(formatEndTime(start, end)).toBe("06:00 (+1)");
  });
});

describe("formatDuration", () => {
  it("formats 0 as 0h 00m", () => {
    expect(formatDuration(0)).toBe("0h 00m");
  });

  it("formats 65 as 1h 05m", () => {
    expect(formatDuration(65)).toBe("1h 05m");
  });

  it("formats 7600 as 126h 40m (hours past 24)", () => {
    expect(formatDuration(7600)).toBe("126h 40m");
  });

  it("formats whole hours", () => {
    expect(formatDuration(480)).toBe("8h 00m");
    expect(formatDuration(485)).toBe("8h 05m");
  });

  it("treats negative, NaN, and Infinity as 0, never NaN", () => {
    expect(formatDuration(-5)).toBe("0h 00m");
    expect(formatDuration(Number.NaN)).toBe("0h 00m");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0h 00m");
  });

  it("rounds fractional minutes", () => {
    expect(formatDuration(59.6)).toBe("1h 00m");
  });
});

describe("formatTimer", () => {
  it("formats 0 as 00:00:00", () => {
    expect(formatTimer(0)).toBe("00:00:00");
  });

  it("formats hours, minutes, and seconds", () => {
    const ms = 4 * HOUR_MS + 32 * 60_000 + 18_000;
    expect(formatTimer(ms)).toBe("04:32:18");
  });

  it("formats 25 hours as 25:00:00", () => {
    expect(formatTimer(25 * HOUR_MS)).toBe("25:00:00");
  });

  it("formats 25:03:00", () => {
    expect(formatTimer(25 * HOUR_MS + 3 * 60_000)).toBe("25:03:00");
  });

  it("floors partial seconds", () => {
    expect(formatTimer(1999)).toBe("00:00:01");
  });

  it("treats negative, NaN, and Infinity as 00:00:00", () => {
    expect(formatTimer(-1000)).toBe("00:00:00");
    expect(formatTimer(Number.NaN)).toBe("00:00:00");
    expect(formatTimer(Number.POSITIVE_INFINITY)).toBe("00:00:00");
  });
});

describe("formatCsvDate", () => {
  it("formats as local YYYY-MM-DD", () => {
    expect(formatCsvDate(new Date(2026, 9, 3, 12, 0))).toBe("2026-10-03");
  });

  it("uses the local date at 00:30, not the UTC date", () => {
    expect(formatCsvDate(new Date(2026, 9, 3, 0, 30))).toBe("2026-10-03");
  });
});

describe("formatMonth", () => {
  it("formats as Month YYYY", () => {
    expect(formatMonth(new Date(2026, 9, 3))).toBe("October 2026");
    expect(formatMonth(new Date(2027, 0, 1, 0, 30))).toBe("January 2027");
  });
});

describe("formatMonthKey", () => {
  it("formats a YYYY-MM key as Month YYYY", () => {
    expect(formatMonthKey("2026-10")).toBe("October 2026");
    expect(formatMonthKey("2026-01")).toBe("January 2026");
  });

  it("returns the no-value marker for an invalid key", () => {
    expect(formatMonthKey("2026-13")).toBe(NO_VALUE);
    expect(formatMonthKey("2026-00")).toBe(NO_VALUE);
    expect(formatMonthKey("oops")).toBe(NO_VALUE);
  });
});

describe("NO_VALUE", () => {
  it("is a dash", () => {
    expect(NO_VALUE).toBe("-");
  });
});
