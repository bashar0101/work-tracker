import { describe, expect, it } from "vitest";
import {
  arabicCount,
  detectLocale,
  directionOf,
  MESSAGES,
  parseLocale,
} from "./i18n";
import { formatPace, formatOptionalDuration } from "./progress";
import {
  formatDate,
  formatDuration,
  formatEndTime,
  formatMonth,
  formatMonthKey,
} from "./time";

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits: must never appear (§13). */
const EASTERN_DIGITS = /[٠-٩۰-۹]/;

/** Every string reachable in a messages object, calling functions with samples. */
function allTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    return allTexts(fn("X", "Y", "Z"));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(allTexts);
  }
  return [];
}

describe("parseLocale", () => {
  it("accepts only en and ar", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("ar")).toBe("ar");
    for (const raw of [null, "", "AR", "ar-SA", "tr", '"ar"']) {
      expect(parseLocale(raw)).toBeNull();
    }
  });
});

describe("detectLocale", () => {
  it("uses the first Arabic or English language", () => {
    expect(detectLocale(["ar-SA", "en-US"])).toBe("ar");
    expect(detectLocale(["ar"])).toBe("ar");
    expect(detectLocale(["en-GB", "ar"])).toBe("en");
    expect(detectLocale(["tr-TR", "ar-EG", "en"])).toBe("ar");
    expect(detectLocale(["tr-TR", "en", "ar"])).toBe("en");
  });

  it("falls back to English", () => {
    expect(detectLocale([])).toBe("en");
    expect(detectLocale(["tr-TR", "de"])).toBe("en");
    // "are" is not Arabic.
    expect(detectLocale(["are"])).toBe("en");
  });

  it("ignores case and spaces", () => {
    expect(detectLocale([" AR-sa "])).toBe("ar");
  });
});

describe("directionOf", () => {
  it("is rtl only for Arabic", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });
});

describe("arabicCount", () => {
  const forms = { one: "جلسة واحدة", two: "جلستان", few: "جلسات", many: "جلسة" };

  it("picks the right plural form", () => {
    expect(arabicCount(0, forms)).toBe("0 جلسة");
    expect(arabicCount(1, forms)).toBe("جلسة واحدة");
    expect(arabicCount(2, forms)).toBe("جلستان");
    expect(arabicCount(3, forms)).toBe("3 جلسات");
    expect(arabicCount(10, forms)).toBe("10 جلسات");
    expect(arabicCount(11, forms)).toBe("11 جلسة");
    expect(arabicCount(100, forms)).toBe("100 جلسة");
    expect(arabicCount(103, forms)).toBe("103 جلسات");
  });
});

describe("messages", () => {
  it("English counts sessions", () => {
    expect(MESSAGES.en.sessions(1)).toBe("1 session");
    expect(MESSAGES.en.sessions(0)).toBe("0 sessions");
    expect(MESSAGES.en.sessions(42)).toBe("42 sessions");
  });

  it("Arabic counts sessions with plural forms", () => {
    expect(MESSAGES.ar.sessions(1)).toBe("جلسة واحدة");
    expect(MESSAGES.ar.sessions(2)).toBe("جلستان");
    expect(MESSAGES.ar.sessions(42)).toBe("42 جلسة");
  });

  it("Arabic has a text for every English text, and none are empty", () => {
    const en = allTexts(MESSAGES.en);
    const ar = allTexts(MESSAGES.ar);
    expect(ar).toHaveLength(en.length);
    for (const text of ar) expect(text.trim()).not.toBe("");
  });

  it("Arabic texts are really Arabic (no English left behind)", () => {
    const arabicLetter = /[؀-ۿ]/;
    for (const text of allTexts(MESSAGES.ar)) {
      // Fixed codes like "CSV" and "PDF" sit next to Arabic words.
      expect(text).toMatch(arabicLetter);
    }
  });

  it("never uses Arabic-Indic digits", () => {
    for (const text of allTexts(MESSAGES.ar)) {
      expect(text).not.toMatch(EASTERN_DIGITS);
    }
  });
});

describe("Arabic formats (§13)", () => {
  const date = new Date(2026, 9, 7, 9, 5);

  it("dates and months use Arabic month names and digits 0-9", () => {
    expect(formatDate(date, "ar")).toBe("07 أكتوبر 2026");
    expect(formatMonth(date, "ar")).toBe("أكتوبر 2026");
    expect(formatMonthKey("2026-01", "ar")).toBe("يناير 2026");
    expect(formatMonthKey("2026-12", "ar")).toBe("ديسمبر 2026");
    expect(formatMonthKey("bad", "ar")).toBe("-");
  });

  it("all 12 Arabic month names are different", () => {
    const names = new Set(
      Array.from({ length: 12 }, (_, i) => formatMonth(new Date(2026, i, 1), "ar")),
    );
    expect(names.size).toBe(12);
  });

  it("durations", () => {
    expect(formatDuration(0, "ar")).toBe("0س 00د");
    expect(formatDuration(65, "ar")).toBe("1س 05د");
    expect(formatDuration(7600, "ar")).toBe("126س 40د");
    expect(formatDuration(Number.NaN, "ar")).toBe("0س 00د");
    expect(formatOptionalDuration(null, "ar")).toBe("-");
  });

  it("pace", () => {
    expect(formatPace({ status: "on-track", differenceMinutes: 5 }, "ar")).toBe(
      "على المسار الصحيح",
    );
    expect(formatPace({ status: "ahead", differenceMinutes: 270 }, "ar")).toBe(
      "متقدّم بـ 4س 30د",
    );
    expect(formatPace({ status: "behind", differenceMinutes: -270 }, "ar")).toBe(
      "متأخر بـ 4س 30د",
    );
  });

  it("English stays the default, so CSV and PDF don't change", () => {
    expect(formatDate(date)).toBe("07 Oct 2026");
    expect(formatDuration(65)).toBe("1h 05m");
    expect(formatMonth(date)).toBe("October 2026");
    expect(formatPace({ status: "ahead", differenceMinutes: 270 })).toBe(
      "Ahead by 4h 30m",
    );
  });

  it("never outputs Arabic-Indic digits", () => {
    const outputs = [
      formatDate(date, "ar"),
      formatMonth(date, "ar"),
      formatDuration(7600, "ar"),
      formatEndTime(new Date(2026, 9, 6, 22, 0), new Date(2026, 9, 7, 6, 0)),
    ];
    for (const text of outputs) expect(text).not.toMatch(EASTERN_DIGITS);
  });
});
