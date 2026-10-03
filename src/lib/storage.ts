// localStorage access and validation (PROJECT_PLAN.md §2, Phase 2).
// This is the only file that may touch localStorage.
// Bad or missing data never throws: reads fall back to [] / null,
// and writes return false.

import type { ActiveSession, WorkSession } from "./types";

export const SESSIONS_KEY = "work_sessions";
export const ACTIVE_SESSION_KEY = "active_work_session";

/** Dispatched on `window` after every successful write (same-tab updates). */
export const STORAGE_CHANGE_EVENT = "work-tracker-storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** True for a complete, consistent session object. */
export function isWorkSession(value: unknown): value is WorkSession {
  if (!isRecord(value)) return false;
  const { id, startTime, endTime, durationMinutes } = value;
  return (
    typeof id === "string" &&
    id.length > 0 &&
    isDateString(startTime) &&
    isDateString(endTime) &&
    Date.parse(endTime) >= Date.parse(startTime) &&
    typeof durationMinutes === "number" &&
    Number.isFinite(durationMinutes) &&
    durationMinutes >= 0
  );
}

/** True for an object with a valid `startTime`. */
export function isActiveSession(value: unknown): value is ActiveSession {
  return isRecord(value) && isDateString(value.startTime);
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Stored sessions. Invalid JSON → `[]`; invalid items are skipped. */
export function parseSessions(raw: string | null): WorkSession[] {
  const data = parseJson(raw);
  if (!Array.isArray(data)) return [];
  return data.filter(isWorkSession).map((s) => ({
    id: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
  }));
}

/** Stored active session, or `null` when missing or invalid. */
export function parseActiveSession(raw: string | null): ActiveSession | null {
  const data = parseJson(raw);
  return isActiveSession(data) ? { startTime: data.startTime } : null;
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Runs a write, then notifies the same tab. Returns false on failure. */
function write(action: (storage: Storage) => void): boolean {
  if (typeof window === "undefined") return false;
  try {
    action(window.localStorage);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  return true;
}

/** Raw `work_sessions` string, for `useSyncExternalStore` snapshots. */
export function readSessionsRaw(): string | null {
  return readRaw(SESSIONS_KEY);
}

/** Raw `active_work_session` string, for `useSyncExternalStore` snapshots. */
export function readActiveSessionRaw(): string | null {
  return readRaw(ACTIVE_SESSION_KEY);
}

export function getSessions(): WorkSession[] {
  return parseSessions(readSessionsRaw());
}

export function getActiveSession(): ActiveSession | null {
  return parseActiveSession(readActiveSessionRaw());
}

export function saveSessions(sessions: WorkSession[]): boolean {
  return write((s) => s.setItem(SESSIONS_KEY, JSON.stringify(sessions)));
}

export function saveActiveSession(active: ActiveSession): boolean {
  return write((s) => s.setItem(ACTIVE_SESSION_KEY, JSON.stringify(active)));
}

export function clearActiveSession(): boolean {
  return write((s) => s.removeItem(ACTIVE_SESSION_KEY));
}

/**
 * Calls `callback` when storage changes in this tab (custom event) or in
 * another tab (`storage` event). Returns an unsubscribe function.
 */
export function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}
