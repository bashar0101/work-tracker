import { describe, expect, it } from "vitest";
import {
  addSessionFromForm,
  checkSessionTimes,
  readSessionForm,
  removeSession,
  sessionToFormValues,
  updateSessionFromForm,
  type SessionFormValues,
  type SessionTimes,
} from "./sessionEdit";
import { getTodayStats } from "./statistics";
import type { WorkSession } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.
const NOW = new Date(2026, 9, 4, 12, 0); // Sun 04 Oct 2026, 12:00 local

/** A completed session from local times on one date (month is 0-based). */
function session(
  id: string,
  d: number,
  startHour: number,
  endHour: number,
  extra: Partial<WorkSession> = {},
): WorkSession {
  const start = new Date(2026, 9, d, startHour, 0);
  const end = new Date(2026, 9, d, endHour, 0);
  return {
    id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes: (endHour - startHour) * 60,
    ...extra,
  };
}

function form(date: string, start: string, end: string): SessionFormValues {
  return { date, start, end };
}

function times(values: SessionFormValues): SessionTimes {
  const read = readSessionForm(values);
  if (!read.ok) throw new Error(`unexpected error: ${read.error}`);
  return read.times;
}

describe("readSessionForm", () => {
  it("reads a same-day session in local time", () => {
    const t = times(form("2026-10-02", "09:00", "17:30"));
    expect(t.start).toEqual(new Date(2026, 9, 2, 9, 0));
    expect(t.end).toEqual(new Date(2026, 9, 2, 17, 30));
    expect(t.durationMinutes).toBe(510);
    expect(t.endsNextDay).toBe(false);
  });

  it("End before Start ends the next day", () => {
    const t = times(form("2026-10-02", "22:00", "06:00"));
    expect(t.end).toEqual(new Date(2026, 9, 3, 6, 0));
    expect(t.durationMinutes).toBe(480);
    expect(t.endsNextDay).toBe(true);
  });

  it("End 1 minute before Start gives the longest session, 23h 59m", () => {
    expect(times(form("2026-10-02", "09:00", "08:59")).durationMinutes).toBe(
      23 * 60 + 59,
    );
  });

  it("End = Start is an error", () => {
    expect(readSessionForm(form("2026-10-02", "09:00", "09:00"))).toEqual({
      ok: false,
      error: "same-time",
    });
  });

  it("ignores seconds from a time picker", () => {
    expect(times(form("2026-10-02", "09:00:30", "10:00")).durationMinutes).toBe(
      60,
    );
  });

  it("rejects empty and invalid values", () => {
    for (const values of [
      form("", "09:00", "10:00"),
      form("2026-10-02", "", "10:00"),
      form("2026-10-02", "09:00", ""),
      form("2026-02-30", "09:00", "10:00"),
      form("02.10.2026", "09:00", "10:00"),
      form("2026-10-02", "24:00", "10:00"),
      form("2026-10-02", "09:60", "10:00"),
      form("2026-10-02", "9:00", "10:00"),
    ]) {
      expect(readSessionForm(values)).toEqual({ ok: false, error: "invalid" });
    }
  });
});

describe("checkSessionTimes", () => {
  const existing = [session("a", 2, 9, 17)]; // 02 Oct 09:00–17:00

  it("accepts a free slot", () => {
    const t = times(form("2026-10-03", "09:00", "17:00"));
    expect(checkSessionTimes(t, existing, null, NOW)).toBeNull();
  });

  it("rejects an end in the future", () => {
    const t = times(form("2026-10-04", "10:00", "12:01"));
    expect(checkSessionTimes(t, [], null, NOW)).toBe("future");
    // Ending exactly now is fine.
    const exact = times(form("2026-10-04", "10:00", "12:00"));
    expect(checkSessionTimes(exact, [], null, NOW)).toBeNull();
  });

  it("rejects an overlap with another session", () => {
    for (const [start, end] of [
      ["08:00", "09:01"], // over the start
      ["16:59", "18:00"], // over the end
      ["10:00", "11:00"], // inside
      ["08:00", "18:00"], // around
    ]) {
      const t = times(form("2026-10-02", start, end));
      expect(checkSessionTimes(t, existing, null, NOW)).toBe("overlap");
    }
  });

  it("allows touching sessions", () => {
    const before = times(form("2026-10-02", "07:00", "09:00"));
    const after = times(form("2026-10-02", "17:00", "19:00"));
    expect(checkSessionTimes(before, existing, null, NOW)).toBeNull();
    expect(checkSessionTimes(after, existing, null, NOW)).toBeNull();
  });

  it("finds an overlap across midnight", () => {
    const night = times(form("2026-10-01", "22:00", "10:00")); // to 02 Oct 10:00
    expect(checkSessionTimes(night, existing, null, NOW)).toBe("overlap");
  });

  it("a session being edited doesn't overlap itself", () => {
    const t = times(form("2026-10-02", "10:00", "18:00"));
    expect(checkSessionTimes(t, existing, null, NOW, "a")).toBeNull();
  });

  it("rejects an overlap with the running session", () => {
    const active = { startTime: new Date(2026, 9, 4, 9, 0).toISOString() };
    const t = times(form("2026-10-04", "08:00", "09:30"));
    expect(checkSessionTimes(t, [], active, NOW)).toBe("overlaps-active");
    // Ending right when the running session started is fine.
    const touching = times(form("2026-10-04", "08:00", "09:00"));
    expect(checkSessionTimes(touching, [], active, NOW)).toBeNull();
  });
});

describe("addSessionFromForm", () => {
  it("adds a session with the current rate", () => {
    const result = addSessionFromForm(
      [],
      form("2026-10-03", "09:00", "17:00"),
      null,
      NOW,
      25,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.sessions).toHaveLength(1);
    const [added] = result.sessions;
    expect(added.id).not.toBe("");
    expect(added.startTime).toBe(new Date(2026, 9, 3, 9, 0).toISOString());
    expect(added.endTime).toBe(new Date(2026, 9, 3, 17, 0).toISOString());
    expect(added.durationMinutes).toBe(480);
    expect(added.hourlyRate).toBe(25);
  });

  it("leaves hourlyRate out when no rate is set", () => {
    const result = addSessionFromForm(
      [],
      form("2026-10-03", "09:00", "17:00"),
      null,
      NOW,
      null,
    );
    if (!result.ok) throw new Error(result.error);
    expect("hourlyRate" in result.sessions[0]).toBe(false);
  });

  it("a night session counts for its start date", () => {
    const result = addSessionFromForm(
      [],
      form("2026-10-02", "22:00", "06:00"),
      null,
      NOW,
      null,
    );
    if (!result.ok) throw new Error(result.error);
    const [added] = result.sessions;
    expect(added.durationMinutes).toBe(480);
    expect(getTodayStats(result.sessions, new Date(2026, 9, 2, 23, 0))).toEqual({
      totalMinutes: 480,
      sessionCount: 1,
    });
    expect(getTodayStats(result.sessions, new Date(2026, 9, 3, 8, 0)).sessionCount).toBe(0);
  });

  it("returns the error and doesn't add on a bad form or overlap", () => {
    const existing = [session("a", 2, 9, 17)];
    expect(
      addSessionFromForm(existing, form("2026-10-02", "10:00", "11:00"), null, NOW, null),
    ).toEqual({ ok: false, error: "overlap" });
    expect(
      addSessionFromForm(existing, form("", "10:00", "11:00"), null, NOW, null),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("doesn't change the input array", () => {
    const input: WorkSession[] = [];
    addSessionFromForm(input, form("2026-10-03", "09:00", "17:00"), null, NOW, null);
    expect(input).toEqual([]);
  });
});

describe("updateSessionFromForm", () => {
  const a = session("a", 2, 9, 17, { hourlyRate: 20 });
  const b = session("b", 3, 9, 17);

  it("changes the times and keeps id and stored rate", () => {
    const result = updateSessionFromForm(
      [a, b],
      "a",
      form("2026-10-02", "08:00", "18:30"),
      null,
      NOW,
    );
    if (!result.ok) throw new Error(result.error);
    const updated = result.sessions[0];
    expect(updated.id).toBe("a");
    expect(updated.hourlyRate).toBe(20);
    expect(updated.durationMinutes).toBe(630);
    expect(updated.startTime).toBe(new Date(2026, 9, 2, 8, 0).toISOString());
    expect(result.sessions[1]).toBe(b);
  });

  it("can move a session across midnight", () => {
    const result = updateSessionFromForm(
      [a],
      "a",
      form("2026-10-02", "22:00", "06:00"),
      null,
      NOW,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.sessions[0].endTime).toBe(
      new Date(2026, 9, 3, 6, 0).toISOString(),
    );
    expect(result.sessions[0].durationMinutes).toBe(480);
  });

  it("rejects an overlap with another session", () => {
    expect(
      updateSessionFromForm([a, b], "a", form("2026-10-03", "08:00", "10:00"), null, NOW),
    ).toEqual({ ok: false, error: "overlap" });
  });

  it("reports a session that no longer exists", () => {
    expect(
      updateSessionFromForm([b], "a", form("2026-10-02", "08:00", "10:00"), null, NOW),
    ).toEqual({ ok: false, error: "not-found" });
  });
});

describe("sessionToFormValues", () => {
  it("gives local date and times, rounded down to the minute", () => {
    const s: WorkSession = {
      id: "x",
      startTime: new Date(2026, 9, 2, 22, 5, 59).toISOString(),
      endTime: new Date(2026, 9, 3, 6, 0, 30).toISOString(),
      durationMinutes: 475,
    };
    expect(sessionToFormValues(s)).toEqual({
      date: "2026-10-02",
      start: "22:05",
      end: "06:00",
    });
  });

  it("uses the local date at 00:30, not the UTC one", () => {
    const s = session("y", 3, 0, 1);
    expect(sessionToFormValues(s).date).toBe("2026-10-03");
  });
});

describe("removeSession", () => {
  it("removes only the matching session", () => {
    const a = session("a", 2, 9, 17);
    const b = session("b", 3, 9, 17);
    expect(removeSession([a, b], "a")).toEqual([b]);
    expect(removeSession([a, b], "missing")).toEqual([a, b]);
  });
});
