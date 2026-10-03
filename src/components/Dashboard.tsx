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
import {
  AlertIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  SunIcon,
} from "./icons";
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
    <div className="relative isolate flex-1 overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/60 to-violet-50">
      {/* Decorative background blobs. Clipped by overflow-hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 -z-10 size-[28rem] rounded-full bg-indigo-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-40 -z-10 size-[32rem] rounded-full bg-violet-300/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 size-[26rem] rounded-full bg-sky-200/30 blur-3xl"
      />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
            <ClockIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Work Hours Tracker
            </h1>
            <p className="text-sm text-slate-600">Track your work time</p>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <StatusCard status={status} activeSession={activeSession} />
          <WorkControls status={status} onStart={startWork} onEnd={endWork} />
          {error && (
            <p
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 shadow-sm"
            >
              <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            title="Today"
            icon={<SunIcon />}
            accent="sky"
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
            icon={<CalendarIcon />}
            accent="violet"
            rows={[
              {
                label: "Total",
                value: formatDuration(stats.week.totalMinutes),
              },
              { label: "Working days", value: String(stats.week.workingDays) },
              {
                label: "Daily average",
                value: formatAverage(stats.week.averageMinutes),
              },
            ]}
          />
          <SummaryCard
            title="This Month"
            icon={<ChartIcon />}
            accent="amber"
            rows={[
              {
                label: "Total",
                value: formatDuration(stats.month.totalMinutes),
              },
              {
                label: "Working days",
                value: String(stats.month.workingDays),
              },
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
    </div>
  );
}
