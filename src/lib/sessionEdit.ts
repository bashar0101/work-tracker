// Edit, delete, and add sessions (PROJECT_PLAN.md §11).
// Nothing here reads the clock or storage: callers pass `now` and the
// freshly read sessions. Every function returns a new array.

import { createId } from "./sessions";
import { dateFromKey } from "./statistics";
import { formatTime, toDateKey } from "./time";
import type { ActiveSession, WorkSession } from "./types";

/** Raw values of the session form: `YYYY-MM-DD`, `HH:mm`, `HH:mm`. */
export interface SessionFormValues {
  date: string;
  start: string;
  end: string;
}

/** Start and end read from the form. */
export interface SessionTimes {
  start: Date;
  end: Date;
  durationMinutes: number;
  /** True when End is earlier than Start: the session ends the next day. */
  endsNextDay: boolean;
}

/** Error codes; the UI shows them with `MESSAGES[locale].form.errors`. */
export type SessionErrorCode =
  | "invalid"
  | "same-time"
  | "future"
  | "overlap"
  | "overlaps-active"
  | "not-found";

export type SessionFormResult =
  | { ok: true; times: SessionTimes }
  | { ok: false; error: SessionErrorCode };

export type SessionEditResult =
  | { ok: true; sessions: WorkSession[] }
  | { ok: false; error: SessionErrorCode };

/** Minutes after midnight from `HH:mm` (seconds are ignored), or `null`. */
function parseTime(text: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Reads the form. If End is earlier than Start, the session ends the next
 * day. Local time, whole minutes.
 */
export function readSessionForm(values: SessionFormValues): SessionFormResult {
  const day = dateFromKey(values.date.trim());
  const startMinutes = parseTime(values.start);
  const endMinutes = parseTime(values.end);
  if (day === null || startMinutes === null || endMinutes === null) {
    return { ok: false, error: "invalid" };
  }
  if (startMinutes === endMinutes) return { ok: false, error: "same-time" };

  const endsNextDay = endMinutes < startMinutes;
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const start = new Date(y, m, d, 0, startMinutes);
  const end = new Date(y, m, d + (endsNextDay ? 1 : 0), 0, endMinutes);
  return {
    ok: true,
    times: {
      start,
      end,
      durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      endsNextDay,
    },
  };
}

/**
 * The §11 rules: no end in the future, no overlap with another completed
 * session (touching is fine), and no overlap with the running session.
 * `ignoreId` is the session being edited, so it can't overlap itself.
 */
export function checkSessionTimes(
  times: SessionTimes,
  sessions: WorkSession[],
  active: ActiveSession | null,
  now: Date,
  ignoreId?: string,
): SessionErrorCode | null {
  const start = times.start.getTime();
  const end = times.end.getTime();
  if (end > now.getTime()) return "future";

  for (const other of sessions) {
    if (other.id === ignoreId) continue;
    const otherStart = Date.parse(other.startTime);
    const otherEnd = Date.parse(other.endTime);
    if (Number.isNaN(otherStart) || Number.isNaN(otherEnd)) continue;
    if (start < otherEnd && end > otherStart) return "overlap";
  }

  if (active) {
    const activeStart = Date.parse(active.startTime);
    if (!Number.isNaN(activeStart) && end > activeStart) {
      return "overlaps-active";
    }
  }
  return null;
}

/** Form values for an existing session (times rounded down to the minute). */
export function sessionToFormValues(session: WorkSession): SessionFormValues {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return {
    date: toDateKey(start),
    start: formatTime(start),
    end: formatTime(end),
  };
}

/**
 * Adds a session from the form. It stores the current rate when one is set,
 * like End Work (§9).
 */
export function addSessionFromForm(
  sessions: WorkSession[],
  values: SessionFormValues,
  active: ActiveSession | null,
  now: Date,
  currentRate: number | null,
): SessionEditResult {
  const read = readSessionForm(values);
  if (!read.ok) return read;
  const error = checkSessionTimes(read.times, sessions, active, now);
  if (error) return { ok: false, error };
  const session: WorkSession = {
    id: createId(),
    startTime: read.times.start.toISOString(),
    endTime: read.times.end.toISOString(),
    durationMinutes: read.times.durationMinutes,
    ...(currentRate !== null ? { hourlyRate: currentRate } : {}),
  };
  return { ok: true, sessions: [...sessions, session] };
}

/** Changes a session's times. Its id and stored rate stay the same. */
export function updateSessionFromForm(
  sessions: WorkSession[],
  id: string,
  values: SessionFormValues,
  active: ActiveSession | null,
  now: Date,
): SessionEditResult {
  if (!sessions.some((s) => s.id === id)) {
    return { ok: false, error: "not-found" };
  }
  const read = readSessionForm(values);
  if (!read.ok) return read;
  const error = checkSessionTimes(read.times, sessions, active, now, id);
  if (error) return { ok: false, error };
  return {
    ok: true,
    sessions: sessions.map((s) =>
      s.id === id
        ? {
            ...s,
            startTime: read.times.start.toISOString(),
            endTime: read.times.end.toISOString(),
            durationMinutes: read.times.durationMinutes,
          }
        : s,
    ),
  };
}

/** All sessions except the one with `id`. */
export function removeSession(
  sessions: WorkSession[],
  id: string,
): WorkSession[] {
  return sessions.filter((s) => s.id !== id);
}
