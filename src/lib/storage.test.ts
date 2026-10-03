import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SESSION_KEY,
  SESSIONS_KEY,
  STORAGE_CHANGE_EVENT,
  clearActiveSession,
  getActiveSession,
  getSessions,
  isActiveSession,
  isWorkSession,
  parseActiveSession,
  parseSessions,
  readActiveSessionRaw,
  readSessionsRaw,
  saveActiveSession,
  saveSessions,
  subscribeToStorage,
} from "./storage";
import type { WorkSession } from "./types";

const valid: WorkSession = {
  id: "a",
  startTime: "2026-10-01T06:00:00.000Z",
  endTime: "2026-10-01T15:00:00.000Z",
  durationMinutes: 540,
};

const nightShift: WorkSession = {
  id: "b",
  startTime: "2026-10-02T19:00:00.000Z",
  endTime: "2026-10-03T03:00:00.000Z",
  durationMinutes: 480,
};

describe("isWorkSession", () => {
  it("accepts a valid session, including zero duration", () => {
    expect(isWorkSession(valid)).toBe(true);
    expect(
      isWorkSession({ ...valid, endTime: valid.startTime, durationMinutes: 0 }),
    ).toBe(true);
  });

  it("rejects non-objects", () => {
    for (const value of [null, undefined, 1, "x", true, [], [valid]]) {
      expect(isWorkSession(value)).toBe(false);
    }
  });

  it("rejects bad fields", () => {
    const bad: unknown[] = [
      { ...valid, id: "" },
      { ...valid, id: 1 },
      { ...valid, startTime: "not a date" },
      { ...valid, endTime: 123 },
      { ...valid, endTime: "2026-10-01T05:00:00.000Z" }, // before start
      { ...valid, durationMinutes: -1 },
      { ...valid, durationMinutes: Number.NaN },
      { ...valid, durationMinutes: Number.POSITIVE_INFINITY },
      { ...valid, durationMinutes: "540" },
      { id: "a", startTime: valid.startTime, endTime: valid.endTime },
    ];
    for (const value of bad) {
      expect(isWorkSession(value)).toBe(false);
    }
  });
});

describe("isActiveSession", () => {
  it("accepts a valid start time", () => {
    expect(isActiveSession({ startTime: valid.startTime })).toBe(true);
  });

  it("rejects bad values", () => {
    for (const value of [
      null,
      "x",
      [],
      {},
      { startTime: "" },
      { startTime: "nope" },
      { startTime: 0 },
    ]) {
      expect(isActiveSession(value)).toBe(false);
    }
  });
});

describe("parseSessions", () => {
  it("returns [] for null and empty string", () => {
    expect(parseSessions(null)).toEqual([]);
    expect(parseSessions("")).toEqual([]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseSessions("{not json")).toEqual([]);
    expect(parseSessions("[1, 2")).toEqual([]);
  });

  it("returns [] for JSON that is not an array", () => {
    expect(parseSessions("{}")).toEqual([]);
    expect(parseSessions(JSON.stringify(valid))).toEqual([]);
    expect(parseSessions("42")).toEqual([]);
    expect(parseSessions('"text"')).toEqual([]);
    expect(parseSessions("null")).toEqual([]);
  });

  it("keeps valid items in order and skips invalid ones", () => {
    const raw = JSON.stringify([
      valid,
      null,
      { ...valid, id: "" },
      "x",
      nightShift,
      { ...valid, durationMinutes: -5 },
    ]);
    expect(parseSessions(raw)).toEqual([valid, nightShift]);
  });

  it("drops unknown extra fields", () => {
    const raw = JSON.stringify([{ ...valid, extra: true }]);
    expect(parseSessions(raw)).toEqual([valid]);
  });

  it("round-trips valid sessions", () => {
    const sessions = [valid, nightShift];
    expect(parseSessions(JSON.stringify(sessions))).toEqual(sessions);
  });
});

describe("parseActiveSession", () => {
  it("returns null for null, empty, and invalid JSON", () => {
    expect(parseActiveSession(null)).toBeNull();
    expect(parseActiveSession("")).toBeNull();
    expect(parseActiveSession("{oops")).toBeNull();
  });

  it("returns null for wrong shapes", () => {
    expect(parseActiveSession("[]")).toBeNull();
    expect(parseActiveSession("42")).toBeNull();
    expect(parseActiveSession('{"startTime":"bad"}')).toBeNull();
  });

  it("returns only the known fields", () => {
    const raw = JSON.stringify({ startTime: valid.startTime, extra: 1 });
    expect(parseActiveSession(raw)).toEqual({ startTime: valid.startTime });
  });

  it("round-trips a valid active session", () => {
    const active = { startTime: valid.startTime };
    expect(parseActiveSession(JSON.stringify(active))).toEqual(active);
  });
});

/** Minimal in-memory localStorage. */
class FakeStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function stubWindow(storage: FakeStorage = new FakeStorage()) {
  const win = Object.assign(new EventTarget(), { localStorage: storage });
  vi.stubGlobal("window", win);
  return win;
}

describe("browser storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads [] / null when there is no window", () => {
    expect(typeof window).toBe("undefined");
    expect(readSessionsRaw()).toBeNull();
    expect(readActiveSessionRaw()).toBeNull();
    expect(getSessions()).toEqual([]);
    expect(getActiveSession()).toBeNull();
    expect(saveSessions([valid])).toBe(false);
    expect(subscribeToStorage(() => {})).toBeTypeOf("function");
  });

  it("reads [] / null when storage is empty", () => {
    stubWindow();
    expect(getSessions()).toEqual([]);
    expect(getActiveSession()).toBeNull();
  });

  it("saves and reads sessions back", () => {
    stubWindow();
    expect(saveSessions([valid, nightShift])).toBe(true);
    expect(readSessionsRaw()).toBe(JSON.stringify([valid, nightShift]));
    expect(getSessions()).toEqual([valid, nightShift]);
  });

  it("saves, reads, and clears the active session", () => {
    stubWindow();
    const active = { startTime: valid.startTime };
    expect(saveActiveSession(active)).toBe(true);
    expect(getActiveSession()).toEqual(active);
    expect(clearActiveSession()).toBe(true);
    expect(readActiveSessionRaw()).toBeNull();
    expect(getActiveSession()).toBeNull();
  });

  it("uses the two separate keys", () => {
    const storage = new FakeStorage();
    stubWindow(storage);
    saveSessions([valid]);
    saveActiveSession({ startTime: valid.startTime });
    expect(storage.getItem(SESSIONS_KEY)).not.toBeNull();
    expect(storage.getItem(ACTIVE_SESSION_KEY)).not.toBeNull();
  });

  it("dispatches the change event after every successful write", () => {
    const win = stubWindow();
    const listener = vi.fn();
    win.addEventListener(STORAGE_CHANGE_EVENT, listener);
    saveSessions([valid]);
    saveActiveSession({ startTime: valid.startTime });
    clearActiveSession();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("returns false and does not throw or notify when a write fails", () => {
    const storage = new FakeStorage();
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const win = stubWindow(storage);
    const listener = vi.fn();
    win.addEventListener(STORAGE_CHANGE_EVENT, listener);
    expect(() => saveSessions([valid])).not.toThrow();
    expect(saveSessions([valid])).toBe(false);
    expect(saveActiveSession({ startTime: valid.startTime })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns null when reading throws", () => {
    const storage = new FakeStorage();
    storage.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    stubWindow(storage);
    expect(readSessionsRaw()).toBeNull();
    expect(getSessions()).toEqual([]);
    expect(getActiveSession()).toBeNull();
  });

  it("subscribes to the custom event and the storage event", () => {
    const win = stubWindow();
    const callback = vi.fn();
    const unsubscribe = subscribeToStorage(callback);
    win.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
    win.dispatchEvent(new Event("storage"));
    expect(callback).toHaveBeenCalledTimes(2);
    unsubscribe();
    win.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
    win.dispatchEvent(new Event("storage"));
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
