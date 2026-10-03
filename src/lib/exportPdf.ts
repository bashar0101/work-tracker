// Monthly PDF report (PROJECT_PLAN.md §7). Formats come from `time.ts` (§4).
//
// `buildPdfReport` is pure: it turns sessions into the report's text.
// `exportPdf` draws that text with jsPDF and downloads the file. jsPDF and
// jspdf-autotable are loaded with dynamic `import()` inside `exportPdf`, so
// they never run on the server and stay out of the first page load.
//
// All text is printable ASCII: jsPDF's built-in Helvetica only covers
// WinAnsi, so characters like "·" or Turkish letters would break.

import {
  dateFromKey,
  getMonthStats,
  getSessionsInMonth,
  type LongestDay,
} from "./statistics";
import {
  formatDate,
  formatDuration,
  formatEndTime,
  formatMonthKey,
  formatTime,
  NO_VALUE,
} from "./time";
import type { WorkSession } from "./types";

export const PDF_TABLE_HEAD = ["Date", "Start", "End", "Duration"] as const;

export const PDF_EMPTY_TEXT = "No sessions in this month.";

export interface PdfReport {
  fileName: string;
  title: string;
  generatedAt: string;
  /** `[label, value]` pairs for the month summary. */
  summary: [string, string][];
  head: string[];
  /** One row per session, oldest first: Date, Start, End, Duration. */
  body: string[][];
}

/** `work-report-YYYY-MM.pdf` for a `YYYY-MM` month key. */
export function pdfFileName(monthKey: string): string {
  return `work-report-${monthKey}.pdf`;
}

function formatAverage(minutes: number | null): string {
  return minutes === null ? NO_VALUE : formatDuration(minutes);
}

/** ASCII only: `02 Oct 2026 (10h 00m)`, or `-` when there is none. */
function formatLongestDay(day: LongestDay | null): string {
  if (!day) return NO_VALUE;
  const date = dateFromKey(day.dateKey);
  if (!date) return NO_VALUE;
  return `${formatDate(date)} (${formatDuration(day.totalMinutes)})`;
}

function toRow(session: WorkSession): string[] {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return [
    formatDate(start),
    formatTime(start),
    formatEndTime(start, end), // "06:00 (+1)" for a night shift
    formatDuration(session.durationMinutes),
  ];
}

/**
 * The report's content for a `YYYY-MM` month. Pure: `now` is only used for
 * the "Generated" line. The summary reuses `getMonthStats`, the same
 * function as the dashboard's "This Month" card.
 */
export function buildPdfReport(
  sessions: WorkSession[],
  monthKey: string,
  now: Date,
): PdfReport {
  const monthDate = dateFromKey(`${monthKey}-01`);
  const stats = monthDate
    ? getMonthStats(sessions, monthDate)
    : { totalMinutes: 0, workingDays: 0, averageMinutes: null, longestDay: null };

  const body = getSessionsInMonth(sessions, monthKey)
    .filter(
      (session) =>
        !Number.isNaN(Date.parse(session.startTime)) &&
        !Number.isNaN(Date.parse(session.endTime)),
    )
    .map(toRow);

  return {
    fileName: pdfFileName(monthKey),
    title: `Work Hours Report - ${formatMonthKey(monthKey)}`,
    generatedAt: `Generated ${formatDate(now)} ${formatTime(now)}`,
    summary: [
      ["Total", formatDuration(stats.totalMinutes)],
      ["Working days", String(stats.workingDays)],
      ["Daily average", formatAverage(stats.averageMinutes)],
      ["Longest day", formatLongestDay(stats.longestDay)],
    ],
    head: [...PDF_TABLE_HEAD],
    body,
  };
}

// Layout in millimetres (A4 portrait is 210 x 297).
const MARGIN = 14;
const VALUE_X = 60;

/**
 * Browser only: builds the month's PDF and downloads it. Errors are not
 * caught here; the caller shows them inline.
 */
export async function exportPdf(
  sessions: WorkSession[],
  monthKey: string,
  now: Date,
): Promise<void> {
  const report = buildPdfReport(sessions, monthKey, now);

  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);

  // 1. Title and the date and time it was generated.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(report.title, MARGIN, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(report.generatedAt, MARGIN, 27);

  // 2. Month summary.
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Month summary", MARGIN, 39);
  doc.setFontSize(11);
  let y = 46;
  for (const [label, value] of report.summary) {
    doc.setFont("helvetica", "normal");
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, VALUE_X, y);
    y += 6;
  }

  // 3. Sessions table, oldest first. Long tables continue on the next page,
  // with the header repeated on every page.
  y += 4;
  if (report.body.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text(PDF_EMPTY_TEXT, MARGIN, y + 4);
  } else {
    autoTable(doc, {
      head: [report.head],
      body: report.body,
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      showHead: "everyPage",
      theme: "striped",
      styles: { font: "helvetica", fontSize: 10 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });
  }

  doc.save(report.fileName);
}
