// Monthly CSV export (PROJECT_PLAN.md §7). Formats come from `time.ts` (§4).
//
// Line endings are CRLF (`\r\n`), as RFC 4180 says, and the file ends with a
// line break. Excel, Google Sheets, and Numbers all read this correctly.

import { sortOldestFirst } from "./sessions";
import { formatCsvDate, formatDuration, formatTime } from "./time";
import type { WorkSession } from "./types";

export const CSV_HEADER = [
  "Date",
  "Start Time",
  "End Time",
  "Duration",
  "Duration Minutes",
] as const;

const LINE_END = "\r\n";

/**
 * Quotes a field that contains a comma, a double quote, or a line break,
 * and doubles any quotes inside it (RFC 4180). Other fields stay as they are.
 */
export function escapeCsvField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toLine(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",") + LINE_END;
}

function toRow(session: WorkSession): string[] {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  const minutes =
    Number.isFinite(session.durationMinutes) && session.durationMinutes > 0
      ? Math.round(session.durationMinutes)
      : 0;
  return [
    formatCsvDate(start), // local date of the start
    formatTime(start),
    formatTime(end), // plain HH:mm, never "(+1)" in the CSV
    formatDuration(minutes),
    String(minutes),
  ];
}

/**
 * The CSV text for these sessions, oldest first. Sessions are sorted here,
 * so the input order doesn't matter. Sessions with an unreadable start or
 * end time are skipped. No sessions gives the header line only.
 */
export function buildCsv(sessions: WorkSession[]): string {
  let csv = toLine(CSV_HEADER);
  for (const session of sortOldestFirst(sessions)) {
    if (
      Number.isNaN(Date.parse(session.startTime)) ||
      Number.isNaN(Date.parse(session.endTime))
    ) {
      continue;
    }
    csv += toLine(toRow(session));
  }
  return csv;
}

/** `work-sessions-YYYY-MM.csv` for a `YYYY-MM` month key. */
export function csvFileName(monthKey: string): string {
  return `work-sessions-${monthKey}.csv`;
}

/**
 * Browser only: downloads `csv` as a file with a Blob and a temporary
 * `<a download>` link. The object URL is revoked after the click has been
 * handled, so Safari and mobile browsers still get the file.
 */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
