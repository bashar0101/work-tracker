import { useMemo } from "react";
import { sortNewestFirst } from "@/lib/sessions";
import {
  formatDate,
  formatDuration,
  formatEndTime,
  formatTime,
} from "@/lib/time";
import type { WorkSession } from "@/lib/types";

interface SessionHistoryProps {
  sessions: WorkSession[];
  loading?: boolean;
}

interface HistoryRow {
  id: string;
  date: string;
  start: string;
  end: string;
  duration: string;
}

function toRow(session: WorkSession): HistoryRow {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return {
    id: session.id,
    date: formatDate(start),
    start: formatTime(start),
    end: formatEndTime(start, end),
    duration: formatDuration(session.durationMinutes),
  };
}

// Completed sessions, newest first. A table from `md`, stacked rows below.
// UI only: sorting and formatting come from src/lib.
export default function SessionHistory({
  sessions,
  loading = false,
}: SessionHistoryProps) {
  const rows = useMemo(() => sortNewestFirst(sessions).map(toRow), [sessions]);

  let content;
  if (loading) {
    content = <p className="text-sm text-gray-500">Loading sessions…</p>;
  } else if (rows.length === 0) {
    content = (
      <p className="text-sm text-gray-600">
        No sessions yet. Press Start Work to begin.
      </p>
    );
  } else {
    content = (
      <>
        <ul className="flex flex-col divide-y divide-gray-100 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 py-3">
              <p className="text-sm font-medium text-gray-900">{row.date}</p>
              <div className="flex flex-wrap justify-between gap-x-3 text-sm tabular-nums">
                <span className="text-gray-600">
                  {row.start} – {row.end}
                </span>
                <span className="ml-auto font-medium text-gray-900">
                  {row.duration}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <table className="hidden w-full text-left text-sm tabular-nums md:table">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th scope="col" className="py-2 pr-4 font-medium">
                Date
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Start
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                End
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-2 pr-4 text-gray-900">{row.date}</td>
                <td className="py-2 pr-4 text-gray-700">{row.start}</td>
                <td className="py-2 pr-4 text-gray-700">{row.end}</td>
                <td className="py-2 text-right font-medium text-gray-900">
                  {row.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <section
      aria-labelledby="session-history-heading"
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2
        id="session-history-heading"
        className="text-lg font-semibold text-gray-900"
      >
        Session History
      </h2>
      {content}
    </section>
  );
}
