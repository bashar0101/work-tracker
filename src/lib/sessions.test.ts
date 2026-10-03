import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createId,
  createSession,
  sortNewestFirst,
  sortOldestFirst,
} from "./sessions";
import type { WorkSession } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createId", () => {
  it("uses crypto.randomUUID when it exists", () => {
    const randomUUID = vi.fn(() => "11111111-2222-3333-4444-555555555555");
    vi.stubGlobal("crypto", { randomUUID });
    expect(createId()).toBe("11111111-2222-3333-4444-555555555555");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back when crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
    }
  });

  it("falls back when crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", {});
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique ids with the real crypto", () => {
    expect(createId()).not.toBe(createId());
  });
});

describe("createSession", () => {
  const start = new Date(2026, 9, 3, 9, 0, 0); // 03 Oct 2026 09:00 local
  const active = { startTime: start.toISOString() };

  function after(ms: number): Date {
    return new Date(start.getTime() + ms);
  }

  it("rounds the duration to the nearest minute", () => {
    expect(createSession(active, after(29_000)).durationMinutes).toBe(0);
    expect(createSession(active, after(30_000)).durationMinutes).toBe(1);
    expect(createSession(active, after(89_000)).durationMinutes).toBe(1);
    expect(createSession(active, after(90_000)).durationMinutes).toBe(2);
    expect(createSession(active, after(8 * 3_600_000)).durationMinutes).toBe(
      480,
    );
  });

  it("handles a session that crosses midnight", () => {
    const nightStart = new Date(2026, 9, 2, 22, 0, 0);
    const nightEnd = new Date(2026, 9, 3, 6, 0, 0);
    const session = createSession(
      { startTime: nightStart.toISOString() },
      nightEnd,
    );
    expect(session.durationMinutes).toBe(480);
  });

  it("keeps the start ISO string and stores the end as ISO", () => {
    const end = after(3_600_000);
    const session = createSession(active, end);
    expect(session.startTime).toBe(active.startTime);
    expect(session.endTime).toBe(end.toISOString());
  });

  it("never returns a negative duration", () => {
    expect(createSession(active, after(-60_000)).durationMinutes).toBe(0);
  });

  it("gives every session a unique id", () => {
    const a = createSession(active, after(60_000));
    const b = createSession(active, after(60_000));
    expect(a.id).not.toBe("");
    expect(a.id).not.toBe(b.id);
  });
});

function session(id: string, startTime: string): WorkSession {
  return { id, startTime, endTime: startTime, durationMinutes: 0 };
}

describe("sortNewestFirst", () => {
  const a = session("a", "2026-10-01T09:00:00.000Z");
  const b = session("b", "2026-10-03T22:00:00.000Z");
  const c = session("c", "2026-10-02T09:00:00.000Z");

  it("puts the newest start first", () => {
    expect(sortNewestFirst([a, b, c]).map((s) => s.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("doesn't change the input", () => {
    const input = [a, b, c];
    const result = sortNewestFirst(input);
    expect(input.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(input);
  });

  it("keeps the input order for equal start times", () => {
    const x = session("x", "2026-10-01T09:00:00.000Z");
    const y = session("y", "2026-10-01T09:00:00.000Z");
    expect(sortNewestFirst([x, y]).map((s) => s.id)).toEqual(["x", "y"]);
  });

  it("puts an unparsable start time last", () => {
    const bad = session("bad", "not a date");
    expect(sortNewestFirst([bad, a, b]).map((s) => s.id)).toEqual([
      "b",
      "a",
      "bad",
    ]);
  });

  it("returns an empty array for no sessions", () => {
    expect(sortNewestFirst([])).toEqual([]);
  });
});

describe("sortOldestFirst", () => {
  it("puts the oldest start first without changing the input", () => {
    const a = session("a", "2026-10-03T09:00:00.000Z");
    const b = session("b", "2026-10-01T09:00:00.000Z");
    const input = [a, b];
    expect(sortOldestFirst(input).map((s) => s.id)).toEqual(["b", "a"]);
    expect(input.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for no sessions", () => {
    expect(sortOldestFirst([])).toEqual([]);
  });
});
