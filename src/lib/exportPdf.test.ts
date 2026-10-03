import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPdfReport, exportPdf, pdfFileName } from "./exportPdf";
import { getMonthStats } from "./statistics";
import { formatDuration } from "./time";
import type { PaySettings, WorkSession } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.

// jsPDF and jspdf-autotable are replaced with spies, so no real PDF is built.
const { save, text, autoTable } = vi.hoisted(() => ({
  save: vi.fn(),
  text: vi.fn(),
  autoTable: vi.fn(),
}));
vi.mock("jspdf", () => ({
  jsPDF: class {
    save = save;
    text = text;
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
  },
}));
vi.mock("jspdf-autotable", () => ({ autoTable }));

let nextId = 0;

/** A completed session from local start parts. Month is 0-based. */
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

const NOW = new Date(2026, 9, 3, 10, 15); // 03 Oct 2026 10:15 local

/** No rate set (the default). */
const NO_PAY: PaySettings = { hourlyRate: null, currency: "TRY" };

/** Every string in the report, for the ASCII check. */
function allStrings(report: ReturnType<typeof buildPdfReport>): string[] {
  return [
    report.fileName,
    report.title,
    report.generatedAt,
    ...report.summary.flat(),
    ...report.head,
    ...report.body.flat(),
  ];
}

describe("pdfFileName", () => {
  it("names the file after the month", () => {
    expect(pdfFileName("2026-10")).toBe("work-report-2026-10.pdf");
  });
});

describe("buildPdfReport", () => {
  it("has the file name, title, generated line, and table head", () => {
    const report = buildPdfReport([], "2026-10", NOW, NO_PAY);
    expect(report.fileName).toBe("work-report-2026-10.pdf");
    expect(report.title).toBe("Work Hours Report - October 2026");
    expect(report.generatedAt).toBe("Generated 03 Oct 2026 10:15");
    expect(report.head).toEqual([
      "Date",
      "Start",
      "End",
      "Duration",
      "Earnings",
    ]);
  });

  it("shows zeros and '-' for an empty month, never NaN", () => {
    const report = buildPdfReport([], "2026-10", NOW, NO_PAY);
    expect(report.summary).toEqual([
      ["Total", "0h 00m"],
      ["Working days", "0"],
      ["Daily average", "-"],
      ["Longest day", "-"],
      ["Earnings", "-"],
    ]);
    expect(report.body).toEqual([]);
    expect(allStrings(report).join(" ")).not.toContain("NaN");
  });

  it("matches getMonthStats; two 5h sessions beat one 9h session", () => {
    const sessions = [
      session(2026, 9, 1, 9, 0, 540), // 01 Oct: 9h
      session(2026, 9, 2, 8, 0, 300), // 02 Oct: 5h
      session(2026, 9, 2, 14, 0, 300), // 02 Oct: 5h → 10h day
    ];
    const stats = getMonthStats(sessions, new Date(2026, 9, 1));
    const report = buildPdfReport(sessions, "2026-10", NOW, NO_PAY);
    expect(report.summary).toEqual([
      ["Total", formatDuration(stats.totalMinutes)],
      ["Working days", String(stats.workingDays)],
      ["Daily average", formatDuration(stats.averageMinutes ?? 0)],
      ["Longest day", "02 Oct 2026 (10h 00m)"],
      ["Earnings", "-"],
    ]);
    expect(report.summary[0]).toEqual(["Total", "19h 00m"]);
    expect(report.summary[2]).toEqual(["Daily average", "9h 30m"]);
  });

  it("lists only that month's sessions, oldest first, with (+1)", () => {
    const night = session(2026, 9, 2, 22, 0, 480); // 22:00 → 06:00 (+1)
    const day = session(2026, 9, 1, 9, 0, 545); // 09:00 → 18:05
    const lastMonth = session(2026, 8, 30, 9, 0, 60);
    const nextMonth = session(2026, 10, 1, 0, 30, 60);
    // 00:30 on 01 Oct local is 30 Sep in UTC: it belongs to October.
    const firstMinute = session(2026, 9, 1, 0, 30, 30);
    const report = buildPdfReport(
      [night, lastMonth, day, nextMonth, firstMinute],
      "2026-10",
      NOW,
      NO_PAY,
    );
    expect(report.body).toEqual([
      ["01 Oct 2026", "00:30", "01:00", "0h 30m", "-"],
      ["01 Oct 2026", "09:00", "18:05", "9h 05m", "-"],
      ["02 Oct 2026", "22:00", "06:00 (+1)", "8h 00m", "-"],
    ]);
  });

  it("shows earnings per session and the month total (§9)", () => {
    const sessions = [
      { ...session(2026, 9, 1, 9, 0, 510), hourlyRate: 25 }, // 212.50
      session(2026, 9, 2, 9, 0, 60), // no stored rate: uses current 100
      { ...session(2026, 8, 30, 9, 0, 60), hourlyRate: 999 }, // other month
    ];
    const pay: PaySettings = { hourlyRate: 100, currency: "USD" };
    const report = buildPdfReport(sessions, "2026-10", NOW, pay);
    expect(report.summary[4]).toEqual(["Earnings", "312.50 USD"]);
    expect(report.body.map((row) => row[4])).toEqual([
      "212.50 USD",
      "100.00 USD",
    ]);
  });

  it("totals only the sessions that have a rate", () => {
    const sessions = [
      { ...session(2026, 9, 1, 9, 0, 60), hourlyRate: 1500 },
      session(2026, 9, 2, 9, 0, 60),
    ];
    const report = buildPdfReport(sessions, "2026-10", NOW, NO_PAY);
    expect(report.summary[4]).toEqual(["Earnings", "1,500.00 TRY"]);
    expect(report.body.map((row) => row[4])).toEqual(["1,500.00 TRY", "-"]);
  });

  it("uses only printable ASCII in every string", () => {
    const sessions = [
      { ...session(2026, 9, 1, 9, 0, 540), hourlyRate: 1234.56 },
      session(2026, 9, 2, 22, 0, 480),
    ];
    for (const pay of [NO_PAY, { hourlyRate: 25, currency: "GBP" } as const]) {
      for (const value of allStrings(
        buildPdfReport(sessions, "2026-10", NOW, pay),
      )) {
        expect(value).toMatch(/^[\x20-\x7E]*$/);
      }
    }
  });
});

describe("exportPdf", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("draws the table and saves the file with the month's name", async () => {
    const sessions = [session(2026, 9, 2, 22, 0, 480)];
    await exportPdf(sessions, "2026-10", NOW, {
      hourlyRate: 25,
      currency: "EUR",
    });

    expect(text).toHaveBeenCalledWith(
      "Work Hours Report - October 2026",
      expect.any(Number),
      expect.any(Number),
    );
    expect(text).toHaveBeenCalledWith(
      "200.00 EUR",
      expect.any(Number),
      expect.any(Number),
    );
    expect(autoTable).toHaveBeenCalledTimes(1);
    const options = autoTable.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      head: [["Date", "Start", "End", "Duration", "Earnings"]],
      body: [["02 Oct 2026", "22:00", "06:00 (+1)", "8h 00m", "200.00 EUR"]],
      showHead: "everyPage",
    });
    expect(save).toHaveBeenCalledWith("work-report-2026-10.pdf");
  });

  it("writes a line instead of an empty table for an empty month", async () => {
    await exportPdf([], "2026-10", NOW, NO_PAY);
    expect(autoTable).not.toHaveBeenCalled();
    expect(text).toHaveBeenCalledWith(
      "No sessions in this month.",
      expect.any(Number),
      expect.any(Number),
    );
    expect(save).toHaveBeenCalledWith("work-report-2026-10.pdf");
  });
});
