// Backup and restore (PROJECT_PLAN.md §12). Pure functions: building the
// file, checking a picked file, and the restore preview. Nothing here reads
// the clock or storage; the download itself is in `download.ts`.

import { sortOldestFirst } from "./sessions";
import { sessionDateKey } from "./statistics";
import {
  cleanSession,
  isWorkSession,
  toPaySettings,
  toWorkTargets,
} from "./storage";
import { toDateKey } from "./time";
import type { AppData, WorkSession } from "./types";

export const BACKUP_APP = "work-hours-tracker";
export const BACKUP_VERSION = 1;

/** Larger files are refused before they are read. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** Error codes; the UI shows them with `MESSAGES[locale].backup.errors`. */
export type BackupErrorCode = "too-large" | "not-backup" | "newer-version";

export interface ParsedBackup extends AppData {
  /** Invalid or duplicate sessions that were left out. */
  skippedSessions: number;
}

export type BackupParseResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: BackupErrorCode };

/** The backup file's text: pretty-printed JSON (§12). */
export function buildBackup(data: AppData, now: Date): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      sessions: data.sessions.map(cleanSession),
      paySettings: toPaySettings(data.paySettings),
      workTargets: toWorkTargets(data.workTargets),
    },
    null,
    2,
  );
}

/** `work-tracker-backup-YYYY-MM-DD.json`, with the local date. */
export function backupFileName(now: Date): string {
  return `work-tracker-backup-${toDateKey(now)}.json`;
}

/** `too-large` for a file over MAX_BACKUP_BYTES, otherwise `null`. */
export function checkBackupSize(bytes: number): BackupErrorCode | null {
  return bytes > MAX_BACKUP_BYTES ? "too-large" : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks a backup file's text. Invalid sessions and repeated ids are
 * skipped and counted (the first of a repeated id is kept). Pay settings
 * and targets fall back to their defaults field by field, like storage.
 */
export function parseBackup(text: string): BackupParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "too-large" };

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "not-backup" };
  }
  if (!isRecord(data) || data.app !== BACKUP_APP) {
    return { ok: false, error: "not-backup" };
  }
  if (typeof data.version === "number" && data.version > BACKUP_VERSION) {
    return { ok: false, error: "newer-version" };
  }
  if (data.version !== BACKUP_VERSION || !Array.isArray(data.sessions)) {
    return { ok: false, error: "not-backup" };
  }

  const seen = new Set<string>();
  const sessions: WorkSession[] = [];
  for (const item of data.sessions) {
    if (!isWorkSession(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    sessions.push(cleanSession(item));
  }

  return {
    ok: true,
    backup: {
      sessions,
      paySettings: toPaySettings(data.paySettings),
      workTargets: toWorkTargets(data.workTargets),
      skippedSessions: data.sessions.length - sessions.length,
    },
  };
}

export interface SessionSummary {
  count: number;
  /** Local date keys of the oldest and newest session, or `null` with none. */
  firstDateKey: string | null;
  lastDateKey: string | null;
}

/** Count and date range, for the restore preview. */
export function summarizeSessions(sessions: WorkSession[]): SessionSummary {
  const sorted = sortOldestFirst(sessions);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    count: sessions.length,
    firstDateKey: first ? sessionDateKey(first) : null,
    lastDateKey: last ? sessionDateKey(last) : null,
  };
}
