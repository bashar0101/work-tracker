"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useWorkTracker } from "@/hooks/useWorkTracker";
import {
  dateFromKey,
  getDefaultMonth,
  getMonthStats,
  getSessionMonths,
  getSessionsInMonth,
  getTodayStats,
  getWeekStats,
  type LongestDay,
} from "@/lib/statistics";
import { buildCsv, csvFileName, downloadCsv } from "@/lib/exportCsv";
import { exportPdf } from "@/lib/exportPdf";
import { formatDate, formatDuration, NO_VALUE } from "@/lib/time";
import ExportControls from "./ExportControls";
import SessionHistory from "./SessionHistory";
import StatusCard from "./StatusCard";
import SummaryCard from "./SummaryCard";
import WorkControls from "./WorkControls";

const MS_PER_MINUTE = 60_000;

// A minute clock for the summary cards, so "Today" changes at midnight
// while the page stays open. The 1-second tick stays inside <Timer>.
function subscribeToMinute(callback: () => void): () => void {
  const id = window.setInterval(callback, MS_PER_MINUTE);
  // Refresh right away when the tab comes back from the background.
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", callback);
  };
}

// Whole minutes: a primitive that stays the same within one minute.
function getMinute(): number {
  return Math.floor(Date.now() / MS_PER_MINUTE);
}

// Server and hydration render. Sessions are empty then, so the cards
// show 0h 00m and "-" until storage has loaded.
function getServerMinute(): number {
  return 0;
}

function formatAverage(minutes: number | null): string {
  return minutes === null ? NO_VALUE : formatDuration(minutes);
}

function formatLongestDay(day: LongestDay | null): string {
  if (!day) return NO_VALUE;
  const date = dateFromKey(day.dateKey);
  if (!date) return NO_VALUE;
  return `${formatDate(date)} · ${formatDuration(day.totalMinutes)}`;
}

export default function Dashboard() {
  const { status, activeSession, sessions, startWork, endWork, error } =
    useWorkTracker();

  const minute = useSyncExternalStore(
    subscribeToMinute,
    getMinute,
    getServerMinute,
  );

  const stats = useMemo(() => {
    const now = new Date(minute * MS_PER_MINUTE);
    return {
      today: getTodayStats(sessions, now),
      week: getWeekStats(sessions, now),
      month: getMonthStats(sessions, now),
    };
  }, [sessions, minute]);

  // Month picker (§7). The user's pick wins while it still has sessions;
  // otherwise the default rule applies. Derived during render, no effects.
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const months = useMemo(() => getSessionMonths(sessions), [sessions]);
  const exportMonth =
    pickedMonth !== null && months.includes(pickedMonth)
      ? pickedMonth
      : getDefaultMonth(months, new Date(minute * MS_PER_MINUTE));

  function handleExportCsv(): void {
    if (exportMonth === null) return;
    downloadCsv(
      buildCsv(getSessionsInMonth(sessions, exportMonth)),
      csvFileName(exportMonth),
    );
  }

  // PDF export (§7). jsPDF loads on the first click, so this is async.
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleExportPdf(): Promise<void> {
    if (exportMonth === null || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      // Reading the clock in an event handler is fine (not during render).
      await exportPdf(sessions, exportMonth, new Date());
    } catch (err) {
      console.error("PDF export failed", err);
      setPdfError("Could not create the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  function handleSelectMonth(monthKey: string): void {
    setPickedMonth(monthKey);
    setPdfError(null); // an old error belongs to the previous month
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Work Hours Tracker
      </h1>

      <div className="flex flex-col gap-4">
        <StatusCard status={status} activeSession={activeSession} />
        <WorkControls status={status} onStart={startWork} onEnd={endWork} />
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Today"
          rows={[
            {
              label: "Total",
              value: formatDuration(stats.today.totalMinutes),
            },
            { label: "Sessions", value: String(stats.today.sessionCount) },
          ]}
        />
        <SummaryCard
          title="This Week"
          rows={[
            { label: "Total", value: formatDuration(stats.week.totalMinutes) },
            { label: "Working days", value: String(stats.week.workingDays) },
            {
              label: "Daily average",
              value: formatAverage(stats.week.averageMinutes),
            },
          ]}
        />
        <SummaryCard
          title="This Month"
          rows={[
            {
              label: "Total",
              value: formatDuration(stats.month.totalMinutes),
            },
            { label: "Working days", value: String(stats.month.workingDays) },
            {
              label: "Daily average",
              value: formatAverage(stats.month.averageMinutes),
            },
            {
              label: "Longest day",
              value: formatLongestDay(stats.month.longestDay),
            },
          ]}
        />
      </div>

      <ExportControls
        months={months}
        selectedMonth={exportMonth}
        onSelectMonth={handleSelectMonth}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        pdfBusy={pdfBusy}
        pdfError={pdfError}
        loading={status === "loading"}
      />

      <SessionHistory sessions={sessions} loading={status === "loading"} />
    </main>
  );
}
