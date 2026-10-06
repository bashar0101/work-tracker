import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SESSION_KEY,
  DEFAULT_PAY_SETTINGS,
  LOCALE_KEY,
  PAY_SETTINGS_KEY,
  SESSIONS_KEY,
  STORAGE_CHANGE_EVENT,
  WORK_TARGETS_KEY,
  clearActiveSession,
  getActiveSession,
  getPaySettings,
  getSessions,
  isActiveSession,
  isWorkSession,
  parseActiveSession,
  parsePaySettings,
  parseSessions,
  parseWorkTargets,
  readActiveSessionRaw,
  readPaySettingsRaw,
  readSessionsRaw,
  readWorkTargetsRaw,
  readLocaleRaw,
  restoreAll,
  saveActiveSession,
  saveLocale,
  savePaySettings,
  saveSessions,
  saveWorkTargets,
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

describe("isWorkSession hourlyRate (§9)", () => {
  it("accepts an old session without hourlyRate", () => {
    expect("hourlyRate" in valid).toBe(false);
    expect(isWorkSession(valid)).toBe(true);
  });

  it("accepts a finite rate of 0 or more", () => {
    expect(isWorkSession({ ...valid, hourlyRate: 25 })).toBe(true);
    expect(isWorkSession({ ...valid, hourlyRate: 25.5 })).toBe(true);
    expect(isWorkSession({ ...valid, hourlyRate: 0 })).toBe(true);
  });

  it("rejects an invalid rate", () => {
    for (const hourlyRate of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "25",
      null,
      {},
    ]) {
      expect(isWorkSession({ ...valid, hourlyRate })).toBe(false);
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

  it("keeps hourlyRate when present and doesn't add it when missing", () => {
    const withRate = { ...nightShift, hourlyRate: 25 };
    const parsed = parseSessions(JSON.stringify([valid, withRate]));
    expect(parsed).toEqual([valid, withRate]);
    expect("hourlyRate" in parsed[0]).toBe(false);
    expect(parsed[1].hourlyRate).toBe(25);
  });

  it("skips items with an invalid hourlyRate and keeps the rest", () => {
    const raw = JSON.stringify([
      valid,
      { ...nightShift, hourlyRate: -5 },
      { ...nightShift, id: "c", hourlyRate: "25" },
      { ...nightShift, id: "d", hourlyRate: null },
      { ...nightShift, id: "e", hourlyRate: 30 },
    ]);
    expect(parseSessions(raw)).toEqual([
      valid,
      { ...nightShift, id: "e", hourlyRate: 30 },
    ]);
  });
});

describe("parsePaySettings", () => {
  it("returns the defaults for missing or invalid JSON", () => {
    expect(DEFAULT_PAY_SETTINGS).toEqual({ hourlyRate: null, currency: "TRY" });
    for (const raw of [null, "", "{oops", "[]", "42", '"x"', "null"]) {
      expect(parsePaySettings(raw)).toEqual(DEFAULT_PAY_SETTINGS);
    }
  });

  it("reads valid settings", () => {
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: 25.5, currency: "USD" })),
    ).toEqual({ hourlyRate: 25.5, currency: "USD" });
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: 0, currency: "GBP" })),
    ).toEqual({ hourlyRate: 0, currency: "GBP" });
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: 100000, currency: "EUR" })),
    ).toEqual({ hourlyRate: 100000, currency: "EUR" });
  });

  it("falls back per field", () => {
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: -1, currency: "USD" })),
    ).toEqual({ hourlyRate: null, currency: "USD" });
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: 100001, currency: "EUR" })),
    ).toEqual({ hourlyRate: null, currency: "EUR" });
    expect(
      parsePaySettings(JSON.stringify({ hourlyRate: "25", currency: "JPY" })),
    ).toEqual({ hourlyRate: null, currency: "TRY" });
    expect(parsePaySettings(JSON.stringify({ hourlyRate: 20 }))).toEqual({
      hourlyRate: 20,
      currency: "TRY",
    });
    expect(parsePaySettings(JSON.stringify({ hourlyRate: null }))).toEqual(
      DEFAULT_PAY_SETTINGS,
    );
  });

  it("drops unknown extra fields", () => {
    const raw = JSON.stringify({ hourlyRate: 10, currency: "USD", extra: 1 });
    expect(parsePaySettings(raw)).toEqual({ hourlyRate: 10, currency: "USD" });
  });
});

describe("parseWorkTargets (§10)", () => {
  const defaults = { dailyHours: 10, daysOffPerMonth: 2 };

  it("returns 10h / 2 days off for missing or invalid JSON", () => {
    for (const raw of [null, "", "{oops", "[]", "42", '"x"', "null"]) {
      expect(parseWorkTargets(raw)).toEqual(defaults);
    }
  });

  it("reads valid targets", () => {
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: 8.5, daysOffPerMonth: 4 })),
    ).toEqual({ dailyHours: 8.5, daysOffPerMonth: 4 });
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: 24, daysOffPerMonth: 0 })),
    ).toEqual({ dailyHours: 24, daysOffPerMonth: 0 });
  });

  it("falls back per field", () => {
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: 0, daysOffPerMonth: 3 })),
    ).toEqual({ dailyHours: 10, daysOffPerMonth: 3 });
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: 9, daysOffPerMonth: 1.5 })),
    ).toEqual({ dailyHours: 9, daysOffPerMonth: 2 });
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: "9", daysOffPerMonth: 11 })),
    ).toEqual(defaults);
    expect(
      parseWorkTargets(JSON.stringify({ dailyHours: 25, daysOffPerMonth: -1 })),
    ).toEqual(defaults);
  });

  it("drops unknown extra fields", () => {
    const raw = JSON.stringify({ dailyHours: 9, daysOffPerMonth: 3, extra: 1 });
    expect(parseWorkTargets(raw)).toEqual({ dailyHours: 9, daysOffPerMonth: 3 });
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
    expect(readPaySettingsRaw()).toBeNull();
    expect(getPaySettings()).toEqual(DEFAULT_PAY_SETTINGS);
    expect(savePaySettings(DEFAULT_PAY_SETTINGS)).toBe(false);
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

  it("saves and reads pay settings under their own key", () => {
    const storage = new FakeStorage();
    stubWindow(storage);
    expect(getPaySettings()).toEqual(DEFAULT_PAY_SETTINGS);
    const settings = { hourlyRate: 25, currency: "EUR" } as const;
    expect(savePaySettings(settings)).toBe(true);
    expect(storage.getItem(PAY_SETTINGS_KEY)).toBe(JSON.stringify(settings));
    expect(readPaySettingsRaw()).toBe(JSON.stringify(settings));
    expect(getPaySettings()).toEqual(settings);
    expect(PAY_SETTINGS_KEY).toBe("pay_settings");
  });

  it("saves and reads work targets under their own key", () => {
    const storage = new FakeStorage();
    stubWindow(storage);
    expect(readWorkTargetsRaw()).toBeNull();
    const targets = { dailyHours: 8, daysOffPerMonth: 4 };
    expect(saveWorkTargets(targets)).toBe(true);
    expect(storage.getItem(WORK_TARGETS_KEY)).toBe(JSON.stringify(targets));
    expect(parseWorkTargets(readWorkTargetsRaw())).toEqual(targets);
    expect(WORK_TARGETS_KEY).toBe("work_targets");
  });

  describe("restoreAll (§12)", () => {
    const data = {
      sessions: [valid, nightShift],
      paySettings: { hourlyRate: 25, currency: "USD" as const },
      workTargets: { dailyHours: 8, daysOffPerMonth: 4 },
    };

    it("replaces all three keys and notifies once", () => {
      const storage = new FakeStorage();
      storage.setItem(SESSIONS_KEY, JSON.stringify([valid]));
      const win = stubWindow(storage);
      const listener = vi.fn();
      win.addEventListener(STORAGE_CHANGE_EVENT, listener);

      expect(restoreAll(data)).toBe(true);
      expect(getSessions()).toEqual([valid, nightShift]);
      expect(getPaySettings()).toEqual(data.paySettings);
      expect(parseWorkTargets(readWorkTargetsRaw())).toEqual(data.workTargets);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("rolls back all keys when a write fails", () => {
      const storage = new FakeStorage();
      storage.setItem(SESSIONS_KEY, JSON.stringify([valid]));
      // No pay settings stored yet: the rollback must remove the key again.
      storage.setItem(WORK_TARGETS_KEY, '{"dailyHours":9,"daysOffPerMonth":1}');
      const before = {
        sessions: storage.getItem(SESSIONS_KEY),
        pay: storage.getItem(PAY_SETTINGS_KEY),
        targets: storage.getItem(WORK_TARGETS_KEY),
      };
      const realSet = storage.setItem.bind(storage);
      let calls = 0;
      storage.setItem = (key: string, value: string) => {
        calls += 1;
        // Sessions and pay settings are written; the targets write fails.
        if (calls === 3) throw new DOMException("full", "QuotaExceededError");
        realSet(key, value);
      };
      const win = stubWindow(storage);
      const listener = vi.fn();
      win.addEventListener(STORAGE_CHANGE_EVENT, listener);

      expect(restoreAll(data)).toBe(false);
      expect(storage.getItem(SESSIONS_KEY)).toBe(before.sessions);
      expect(storage.getItem(PAY_SETTINGS_KEY)).toBe(before.pay);
      expect(before.pay).toBeNull();
      expect(storage.getItem(WORK_TARGETS_KEY)).toBe(before.targets);
      expect(listener).not.toHaveBeenCalled();
    });

    it("returns false when there is no window or reading fails", () => {
      expect(restoreAll(data)).toBe(false);
      const storage = new FakeStorage();
      storage.getItem = () => {
        throw new DOMException("denied", "SecurityError");
      };
      stubWindow(storage);
      expect(restoreAll(data)).toBe(false);
    });

    it("stores only known fields", () => {
      const storage = new FakeStorage();
      stubWindow(storage);
      const extra = { ...valid, extra: 1 } as WorkSession;
      restoreAll({ ...data, sessions: [extra] });
      expect(storage.getItem(SESSIONS_KEY)).toBe(JSON.stringify([valid]));
    });
  });

  it("saves the UI language as a plain string under its own key (§13)", () => {
    const storage = new FakeStorage();
    const win = stubWindow(storage);
    const listener = vi.fn();
    win.addEventListener(STORAGE_CHANGE_EVENT, listener);
    expect(readLocaleRaw()).toBeNull();
    expect(saveLocale("ar")).toBe(true);
    expect(storage.getItem(LOCALE_KEY)).toBe("ar");
    expect(readLocaleRaw()).toBe("ar");
    expect(LOCALE_KEY).toBe("ui_language");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("the backup restore doesn't touch the UI language", () => {
    const storage = new FakeStorage();
    storage.setItem(LOCALE_KEY, "ar");
    stubWindow(storage);
    restoreAll({
      sessions: [],
      paySettings: DEFAULT_PAY_SETTINGS,
      workTargets: { dailyHours: 10, daysOffPerMonth: 2 },
    });
    expect(storage.getItem(LOCALE_KEY)).toBe("ar");
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
    savePaySettings({ hourlyRate: 10, currency: "TRY" });
    saveWorkTargets({ dailyHours: 10, daysOffPerMonth: 2 });
    expect(listener).toHaveBeenCalledTimes(5);
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
    expect(savePaySettings({ hourlyRate: 10, currency: "TRY" })).toBe(false);
    expect(saveWorkTargets({ dailyHours: 10, daysOffPerMonth: 2 })).toBe(false);
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
    expect(getPaySettings()).toEqual(DEFAULT_PAY_SETTINGS);
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
