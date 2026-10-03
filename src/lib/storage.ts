// localStorage access and validation (PROJECT_PLAN.md §2, Phase 2).
// This is the only file that may touch localStorage.
// Bad or missing data never throws: reads fall back to [] / null,
// and writes return false.

import { DEFAULT_CURRENCY, isCurrency, MAX_HOURLY_RATE } from "./earnings";
import type { ActiveSession, PaySettings, WorkSession } from "./types";

export const SESSIONS_KEY = "work_sessions";
export const ACTIVE_SESSION_KEY = "active_work_session";
export const PAY_SETTINGS_KEY = "pay_settings";

/** No rate set yet, currency TRY (PROJECT_PLAN.md §2, §9). */
export const DEFAULT_PAY_SETTINGS: PaySettings = {
  hourlyRate: null,
  currency: DEFAULT_CURRENCY,
};

/** Dispatched on `window` after every successful write (same-tab updates). */
export const STORAGE_CHANGE_EVENT = "work-tracker-storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * True for a complete, consistent session object. `hourlyRate` is optional
 * (older sessions don't have it); when present it must be a finite number,
 * 0 or more.
 */
export function isWorkSession(value: unknown): value is WorkSession {
  if (!isRecord(value)) return false;
  const { id, startTime, endTime, durationMinutes, hourlyRate } = value;
  return (
    (hourlyRate === undefined || isRate(hourlyRate)) &&
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
    ...(s.hourlyRate !== undefined ? { hourlyRate: s.hourlyRate } : {}),
  }));
}

/** Stored active session, or `null` when missing or invalid. */
export function parseActiveSession(raw: string | null): ActiveSession | null {
  const data = parseJson(raw);
  return isActiveSession(data) ? { startTime: data.startTime } : null;
}

/**
 * Stored pay settings. Each field falls back to its default on its own:
 * a rate must be finite, 0 to MAX_HOURLY_RATE (else `null`); an unknown
 * currency becomes TRY. Missing or invalid JSON gives the defaults.
 */
export function parsePaySettings(raw: string | null): PaySettings {
  const data = parseJson(raw);
  if (!isRecord(data)) return { ...DEFAULT_PAY_SETTINGS };
  const { hourlyRate, currency } = data;
  return {
    hourlyRate:
      isRate(hourlyRate) && hourlyRate <= MAX_HOURLY_RATE ? hourlyRate : null,
    currency: isCurrency(currency) ? currency : DEFAULT_PAY_SETTINGS.currency,
  };
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

/** Raw `pay_settings` string, for `useSyncExternalStore` snapshots. */
export function readPaySettingsRaw(): string | null {
  return readRaw(PAY_SETTINGS_KEY);
}

export function getSessions(): WorkSession[] {
  return parseSessions(readSessionsRaw());
}

export function getActiveSession(): ActiveSession | null {
  return parseActiveSession(readActiveSessionRaw());
}

export function getPaySettings(): PaySettings {
  return parsePaySettings(readPaySettingsRaw());
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

export function savePaySettings(settings: PaySettings): boolean {
  const value: PaySettings = {
    hourlyRate: settings.hourlyRate,
    currency: settings.currency,
  };
  return write((s) => s.setItem(PAY_SETTINGS_KEY, JSON.stringify(value)));
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
