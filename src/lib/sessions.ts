// Session helpers (PROJECT_PLAN.md §2, §3). Nothing here reads the clock:
// callers pass `now`.

import type { ActiveSession, WorkSession } from "./types";

/**
 * A unique id. Uses `crypto.randomUUID()` when it exists. It doesn't exist
 * on plain-HTTP addresses (e.g. testing on a phone), so there is a fallback.
 */
export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  const time = Date.now().toString(36);
  const randomA = Math.random().toString(36).slice(2, 10);
  const randomB = Math.random().toString(36).slice(2, 10);
  return `${time}-${randomA}-${randomB}`;
}

/** A completed session from the active one, ending at `now`. */
export function createSession(active: ActiveSession, now: Date): WorkSession {
  const startMs = Date.parse(active.startTime);
  const endMs = now.getTime();
  const diff = endMs - startMs;
  const durationMinutes = Number.isFinite(diff)
    ? Math.max(0, Math.round(diff / 60_000))
    : 0;
  return {
    id: createId(),
    startTime: active.startTime,
    endTime: now.toISOString(),
    durationMinutes,
  };
}

/** Start time in ms. An unparsable time sorts as the oldest. */
function startMs(session: WorkSession): number {
  const ms = Date.parse(session.startTime);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function compareByStart(a: WorkSession, b: WorkSession): number {
  const x = startMs(a);
  const y = startMs(b);
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

/** A new array, newest start first. Stable; doesn't change the input. */
export function sortNewestFirst(sessions: WorkSession[]): WorkSession[] {
  return [...sessions].sort((a, b) => compareByStart(b, a));
}

/** A new array, oldest start first. Stable; doesn't change the input. */
export function sortOldestFirst(sessions: WorkSession[]): WorkSession[] {
  return [...sessions].sort(compareByStart);
}
