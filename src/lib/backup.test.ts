import { describe, expect, it } from "vitest";
import {
  BACKUP_APP,
  backupFileName,
  buildBackup,
  checkBackupSize,
  MAX_BACKUP_BYTES,
  parseBackup,
  summarizeSessions,
} from "./backup";
import type { AppData, WorkSession } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.
const NOW = new Date(2026, 9, 6, 9, 15);

function session(id: string, d: number, extra: Partial<WorkSession> = {}): WorkSession {
  const start = new Date(2026, 9, d, 9, 0);
  const end = new Date(2026, 9, d, 17, 0);
  return {
    id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes: 480,
    ...extra,
  };
}

const DATA: AppData = {
  sessions: [session("a", 1, { hourlyRate: 25 }), session("b", 2)],
  paySettings: { hourlyRate: 30, currency: "USD" },
  workTargets: { dailyHours: 8.5, daysOffPerMonth: 4 },
};

/** A backup file's text from a plain object. */
function file(content: object): string {
  return JSON.stringify(content);
}

const VALID = { app: BACKUP_APP, version: 1, exportedAt: NOW.toISOString() };

describe("buildBackup", () => {
  it("writes the app marker, version, time, and all data", () => {
    const parsed: unknown = JSON.parse(buildBackup(DATA, NOW));
    expect(parsed).toEqual({
      app: "work-hours-tracker",
      version: 1,
      exportedAt: NOW.toISOString(),
      sessions: DATA.sessions,
      paySettings: DATA.paySettings,
      workTargets: DATA.workTargets,
    });
  });

  it("is pretty-printed so people can read it", () => {
    expect(buildBackup(DATA, NOW)).toContain('\n  "app": "work-hours-tracker"');
  });

  it("round-trips: build → parse gives the same data", () => {
    expect(parseBackup(buildBackup(DATA, NOW))).toEqual({
      ok: true,
      backup: { ...DATA, skippedSessions: 0 },
    });
  });

  it("works with no sessions", () => {
    const empty = { ...DATA, sessions: [] };
    expect(parseBackup(buildBackup(empty, NOW))).toEqual({
      ok: true,
      backup: { ...empty, skippedSessions: 0 },
    });
  });
});

describe("backupFileName", () => {
  it("uses the local date, not the UTC one", () => {
    // 00:30 on 6 Oct local is still 5 Oct in UTC.
    expect(backupFileName(new Date(2026, 9, 6, 0, 30))).toBe(
      "work-tracker-backup-2026-10-06.json",
    );
  });
});

describe("checkBackupSize", () => {
  it("refuses files over 5 MB", () => {
    expect(checkBackupSize(1000)).toBeNull();
    expect(checkBackupSize(MAX_BACKUP_BYTES)).toBeNull();
    expect(checkBackupSize(MAX_BACKUP_BYTES + 1)).toBe("too-large");
  });
});

describe("parseBackup", () => {
  it("rejects text that isn't JSON", () => {
    for (const text of ["", "hello", "{oops", "Date,Start\n2026-10-01,09:00"]) {
      expect(parseBackup(text)).toEqual({ ok: false, error: "not-backup" });
    }
  });

  it("rejects JSON from something else", () => {
    for (const content of [
      [],
      { sessions: [] },
      { ...VALID, app: "other-app", sessions: [] },
    ]) {
      expect(parseBackup(file(content))).toEqual({ ok: false, error: "not-backup" });
    }
    expect(parseBackup("42")).toEqual({ ok: false, error: "not-backup" });
  });

  it("rejects a newer version", () => {
    expect(parseBackup(file({ ...VALID, version: 2, sessions: [] }))).toEqual({
      ok: false,
      error: "newer-version",
    });
  });

  it("rejects a missing or odd version", () => {
    for (const version of [undefined, 0, "1", null]) {
      expect(parseBackup(file({ ...VALID, version, sessions: [] }))).toEqual({
        ok: false,
        error: "not-backup",
      });
    }
  });

  it("rejects sessions that aren't an array", () => {
    for (const sessions of [undefined, {}, "x", null]) {
      expect(parseBackup(file({ ...VALID, sessions }))).toEqual({
        ok: false,
        error: "not-backup",
      });
    }
  });

  it("skips invalid and repeated sessions and counts them", () => {
    const a = session("a", 1);
    const result = parseBackup(
      file({
        ...VALID,
        sessions: [
          a,
          null,
          { ...session("b", 2), durationMinutes: -1 },
          { ...session("a", 3) }, // repeated id: the first one wins
          session("c", 4),
        ],
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.sessions.map((s) => s.id)).toEqual(["a", "c"]);
    expect(result.backup.sessions[0]).toEqual(a);
    expect(result.backup.skippedSessions).toBe(3);
  });

  it("drops unknown fields from sessions", () => {
    const result = parseBackup(
      file({ ...VALID, sessions: [{ ...session("a", 1), extra: true }] }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.sessions).toEqual([session("a", 1)]);
  });

  it("falls back to defaults for bad or missing settings", () => {
    const result = parseBackup(
      file({
        ...VALID,
        sessions: [],
        paySettings: { hourlyRate: -5, currency: "JPY" },
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.paySettings).toEqual({ hourlyRate: null, currency: "TRY" });
    expect(result.backup.workTargets).toEqual({ dailyHours: 10, daysOffPerMonth: 2 });
  });
});

describe("summarizeSessions", () => {
  it("gives count and oldest/newest local dates in any order", () => {
    expect(
      summarizeSessions([session("b", 5), session("a", 1), session("c", 3)]),
    ).toEqual({ count: 3, firstDateKey: "2026-10-01", lastDateKey: "2026-10-05" });
  });

  it("uses the local start date at 00:30", () => {
    const early: WorkSession = {
      id: "x",
      startTime: new Date(2026, 9, 1, 0, 30).toISOString(),
      endTime: new Date(2026, 9, 1, 1, 30).toISOString(),
      durationMinutes: 60,
    };
    expect(summarizeSessions([early]).firstDateKey).toBe("2026-10-01");
  });

  it("handles no sessions", () => {
    expect(summarizeSessions([])).toEqual({
      count: 0,
      firstDateKey: null,
      lastDateKey: null,
    });
  });
});
