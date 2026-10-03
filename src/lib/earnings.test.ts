import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  effectiveRate,
  formatCsvMoney,
  formatCsvRate,
  formatMoney,
  isCurrency,
  liveEarningsCents,
  parseRateInput,
  rateInputText,
  rateToCents,
  sessionEarningsCents,
  totalEarningsCents,
} from "./earnings";
import type { WorkSession } from "./types";

let nextId = 0;

function session(durationMinutes: number, hourlyRate?: number): WorkSession {
  nextId += 1;
  return {
    id: `s${nextId}`,
    startTime: "2026-10-01T06:00:00.000Z",
    endTime: "2026-10-01T15:00:00.000Z",
    durationMinutes,
    ...(hourlyRate !== undefined ? { hourlyRate } : {}),
  };
}

describe("currencies", () => {
  it("lists TRY, USD, EUR, GBP", () => {
    expect(CURRENCIES).toEqual(["TRY", "USD", "EUR", "GBP"]);
  });

  it("recognises only those codes", () => {
    for (const code of CURRENCIES) expect(isCurrency(code)).toBe(true);
    for (const value of ["try", "JPY", "", null, 1, undefined]) {
      expect(isCurrency(value)).toBe(false);
    }
  });
});

describe("effectiveRate", () => {
  it("uses the stored rate first", () => {
    expect(effectiveRate(session(60, 30), 25)).toBe(30);
    expect(effectiveRate(session(60, 30), null)).toBe(30);
  });

  it("uses the current rate when the session has none", () => {
    expect(effectiveRate(session(60), 25)).toBe(25);
  });

  it("returns null when no rate applies", () => {
    expect(effectiveRate(session(60), null)).toBeNull();
  });

  it("keeps a stored rate of 0", () => {
    expect(effectiveRate(session(60, 0), 25)).toBe(0);
  });
});

describe("sessionEarningsCents", () => {
  it("8h 30m at 25.00 → 21250 cents (212.50)", () => {
    expect(sessionEarningsCents(session(510), 25)).toBe(21_250);
    expect(formatCsvMoney(sessionEarningsCents(session(510), 25))).toBe(
      "212.50",
    );
  });

  it("rounds to the nearest cent", () => {
    // 1 min at 25.00 = 41.666… cents → 42
    expect(sessionEarningsCents(session(1), 25)).toBe(42);
    // 1 min at 10.00 = 16.666… cents → 17
    expect(sessionEarningsCents(session(1), 10)).toBe(17);
    // 7 min at 13.33 = 155.516… cents → 156
    expect(sessionEarningsCents(session(7), 13.33)).toBe(156);
    // 1 min at 0.30 = 0.5 cents → 1 (round half up)
    expect(sessionEarningsCents(session(1), 0.3)).toBe(1);
  });

  it("avoids float errors in the rate (10.05 * 100)", () => {
    expect(sessionEarningsCents(session(60), 10.05)).toBe(1005);
  });

  it("keeps the stored rate after the current rate changes", () => {
    const s = session(60, 20);
    expect(sessionEarningsCents(s, 20)).toBe(2000);
    expect(sessionEarningsCents(s, 50)).toBe(2000);
    expect(sessionEarningsCents(s, null)).toBe(2000);
  });

  it("uses the current rate for a session without one", () => {
    const s = session(60);
    expect(sessionEarningsCents(s, 20)).toBe(2000);
    expect(sessionEarningsCents(s, 50)).toBe(5000);
  });

  it("returns null when no rate applies, never 0 or NaN", () => {
    expect(sessionEarningsCents(session(60), null)).toBeNull();
    expect(formatMoney(sessionEarningsCents(session(60), null), "TRY")).toBe(
      "-",
    );
  });

  it("treats a bad duration as 0 minutes", () => {
    expect(sessionEarningsCents(session(Number.NaN), 25)).toBe(0);
    expect(sessionEarningsCents(session(-5), 25)).toBe(0);
  });
});

describe("totalEarningsCents", () => {
  it("is null for no sessions", () => {
    expect(totalEarningsCents([], 25)).toBeNull();
  });

  it("is null when no session has a rate", () => {
    expect(totalEarningsCents([session(60), session(30)], null)).toBeNull();
  });

  it("adds only the sessions that have a rate (mixed)", () => {
    const sessions = [session(60, 20), session(30), session(90, 10)];
    // No current rate: 2000 + 1500, the session without a rate is left out.
    expect(totalEarningsCents(sessions, null)).toBe(3500);
    // With a current rate, the session without one uses it: + 30 min × 40.
    expect(totalEarningsCents(sessions, 40)).toBe(5500);
  });

  it("is the sum of session cents", () => {
    const sessions = [session(1, 25), session(1, 25), session(1, 25)];
    expect(totalEarningsCents(sessions, null)).toBe(42 * 3);
  });
});

describe("liveEarningsCents", () => {
  it("is elapsed seconds × rate, rounded to cents", () => {
    expect(liveEarningsCents(3_600_000, 25)).toBe(2500); // 1 h
    expect(liveEarningsCents(60_000, 25)).toBe(42); // 1 min = 41.67
    expect(liveEarningsCents(1_000, 36)).toBe(1); // 1 s at 36/h = 1 cent
  });

  it("uses whole seconds", () => {
    expect(liveEarningsCents(1_999, 36)).toBe(1);
  });

  it("is never negative or NaN", () => {
    expect(liveEarningsCents(-5_000, 25)).toBe(0);
    expect(liveEarningsCents(Number.NaN, 25)).toBe(0);
    expect(liveEarningsCents(60_000, Number.NaN)).toBe(0);
    expect(liveEarningsCents(60_000, -1)).toBe(0);
    expect(liveEarningsCents(0, 25)).toBe(0);
  });

  it("goes past 24 hours", () => {
    expect(liveEarningsCents(25 * 3_600_000, 10)).toBe(25_000);
  });
});

describe("formatMoney", () => {
  it("1,250.00 TRY", () => {
    expect(formatMoney(125_000, "TRY")).toBe("1,250.00 TRY");
  });

  it("0.00 USD", () => {
    expect(formatMoney(0, "USD")).toBe("0.00 USD");
  });

  it("large numbers: 1,234,567.89", () => {
    expect(formatMoney(123_456_789, "EUR")).toBe("1,234,567.89 EUR");
    expect(formatMoney(100_000_000_000, "GBP")).toBe("1,000,000,000.00 GBP");
  });

  it("small amounts and exact thousands", () => {
    expect(formatMoney(5, "TRY")).toBe("0.05 TRY");
    expect(formatMoney(99_999, "TRY")).toBe("999.99 TRY");
    expect(formatMoney(100_000, "TRY")).toBe("1,000.00 TRY");
  });

  it("'-' for unknown amounts", () => {
    expect(formatMoney(null, "TRY")).toBe("-");
    expect(formatMoney(Number.NaN, "TRY")).toBe("-");
  });

  it("uses only ASCII digits and separators", () => {
    expect(formatMoney(123_456_789, "TRY")).toMatch(/^[0-9,]+\.[0-9]{2} TRY$/);
  });
});

describe("CSV money formats", () => {
  it("formatCsvMoney: plain number, 2 decimals, no thousands separator", () => {
    expect(formatCsvMoney(21_250)).toBe("212.50");
    expect(formatCsvMoney(123_456_789)).toBe("1234567.89");
    expect(formatCsvMoney(0)).toBe("0.00");
    expect(formatCsvMoney(null)).toBe("");
  });

  it("formatCsvRate", () => {
    expect(formatCsvRate(25)).toBe("25.00");
    expect(formatCsvRate(25.5)).toBe("25.50");
    expect(formatCsvRate(0)).toBe("0.00");
    expect(formatCsvRate(null)).toBe("");
  });
});

describe("rateToCents / rateInputText", () => {
  it("turns a rate into whole cents", () => {
    expect(rateToCents(25)).toBe(2500);
    expect(rateToCents(10.05)).toBe(1005);
  });

  it("shows a saved rate in the input", () => {
    expect(rateInputText(25)).toBe("25");
    expect(rateInputText(25.5)).toBe("25.5");
    expect(rateInputText(null)).toBe("");
  });
});

describe("parseRateInput", () => {
  it("accepts whole numbers and up to 2 decimals", () => {
    expect(parseRateInput("25")).toBe(25);
    expect(parseRateInput("25.5")).toBe(25.5);
    expect(parseRateInput("25.50")).toBe(25.5);
    expect(parseRateInput("0")).toBe(0);
    expect(parseRateInput("100000")).toBe(100_000);
  });

  it("accepts a comma decimal and surrounding spaces", () => {
    expect(parseRateInput("25,50")).toBe(25.5);
    expect(parseRateInput("  25  ")).toBe(25);
  });

  it("rejects invalid values", () => {
    for (const text of [
      "",
      "   ",
      "-1",
      "-0.5",
      "100000.01",
      "200000",
      "25.555",
      "abc",
      "25abc",
      "1e3",
      "25.",
      ".5",
      "1,000.00",
      "Infinity",
      "NaN",
    ]) {
      expect(parseRateInput(text)).toBeNull();
    }
  });
});
