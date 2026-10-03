import { useMemo } from "react";
import { formatMoney, sessionEarningsCents } from "@/lib/earnings";
import { sortNewestFirst } from "@/lib/sessions";
import {
  formatDate,
  formatDuration,
  formatEndTime,
  formatTime,
} from "@/lib/time";
import type { Currency, WorkSession } from "@/lib/types";
import { HistoryIcon } from "./icons";

interface SessionHistoryProps {
  sessions: WorkSession[];
  /** Used for sessions without a stored rate (§9). */
  currentRate: number | null;
  currency: Currency;
  loading?: boolean;
}

interface HistoryRow {
  id: string;
  date: string;
  start: string;
  end: string;
  duration: string;
  earnings: string;
}

function toRow(
  session: WorkSession,
  currentRate: number | null,
  currency: Currency,
): HistoryRow {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return {
    id: session.id,
    date: formatDate(start),
    start: formatTime(start),
    end: formatEndTime(start, end),
    duration: formatDuration(session.durationMinutes),
    earnings: formatMoney(sessionEarningsCents(session, currentRate), currency),
  };
}

// Completed sessions, newest first. A table from `md`, stacked rows below.
// UI only: sorting and formatting come from src/lib.
export default function SessionHistory({
  sessions,
  currentRate,
  currency,
  loading = false,
}: SessionHistoryProps) {
  const rows = useMemo(
    () =>
      sortNewestFirst(sessions).map((session) =>
        toRow(session, currentRate, currency),
      ),
    [sessions, currentRate, currency],
  );

  let content;
  if (loading) {
    content = (
      <p className="animate-pulse text-sm text-slate-500 motion-reduce:animate-none">
        Loading sessions…
      </p>
    );
  } else if (rows.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-900/5">
          <HistoryIcon className="size-6" />
        </div>
        <p className="text-sm text-slate-600">
          No sessions yet. Press Start Work to begin.
        </p>
      </div>
    );
  } else {
    content = (
      <>
        <ul className="-mx-2 flex flex-col divide-y divide-slate-100 md:hidden">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-lg px-2 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-semibold text-slate-900">
                  {row.date}
                </p>
                <p className="text-sm tabular-nums text-slate-600">
                  {row.start} – {row.end}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-indigo-700">
                  {row.duration}
                </span>
                <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">
                  <span className="sr-only">Earnings: </span>
                  {row.earnings}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-xl ring-1 ring-slate-200/70 md:block">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="bg-slate-50/80">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Start
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  End
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Duration
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Earnings
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/60">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    {row.date}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{row.start}</td>
                  <td className="px-4 py-3.5 text-slate-700">{row.end}</td>
                  <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap text-slate-900">
                    {row.duration}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap text-slate-700">
                    {row.earnings}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <section
      aria-labelledby="session-history-heading"
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/15">
          <HistoryIcon />
        </div>
        <h2
          id="session-history-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Session History
        </h2>
        {!loading && rows.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-900/5">
            {rows.length}
          </span>
        )}
      </div>
      {content}
    </section>
  );
}
