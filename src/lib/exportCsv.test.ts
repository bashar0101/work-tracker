import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCsv,
  csvFileName,
  downloadCsv,
  escapeCsvField,
} from "./exportCsv";
import type { WorkSession } from "./types";

// Tests run in Europe/Istanbul (UTC+3), set in vitest.config.ts.

const HEADER = "Date,Start Time,End Time,Duration,Duration Minutes";

let nextId = 0;

/** A completed session from local start parts. Month is 0-based. */
function session(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  durationMinutes: number,
): WorkSession {
  const start = new Date(y, m, d, h, min);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  nextId += 1;
  return {
    id: `s${nextId}`,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes,
  };
}

describe("buildCsv", () => {
  it("starts with the exact header and ends with CRLF", () => {
    const csv = buildCsv([]);
    expect(csv).toBe(`${HEADER}\r\n`);
  });

  it("matches the §7 example: §4 formats, oldest first, plain end time", () => {
    const dayShift = session(2026, 9, 1, 9, 0, 540); // 09:00 → 18:00
    const nightShift = session(2026, 9, 2, 22, 0, 480); // 22:00 → 06:00 (+1)
    // Input is newest first; the CSV must still be oldest first.
    expect(buildCsv([nightShift, dayShift])).toBe(
      `${HEADER}\r\n` +
        "2026-10-01,09:00,18:00,9h 00m,540\r\n" +
        "2026-10-02,22:00,06:00,8h 00m,480\r\n",
    );
  });

  it("sorts an unsorted list oldest first", () => {
    const a = session(2026, 9, 3, 9, 0, 60);
    const b = session(2026, 9, 1, 9, 0, 60);
    const c = session(2026, 9, 2, 9, 0, 60);
    const dates = buildCsv([a, b, c])
      .split("\r\n")
      .slice(1, -1)
      .map((line) => line.split(",")[0]);
    expect(dates).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("uses the local date near midnight, not the UTC date", () => {
    // 03 Oct 2026 00:30 in Istanbul is 02 Oct 2026 21:30 UTC.
    const s = session(2026, 9, 3, 0, 30, 65);
    expect(s.startTime.startsWith("2026-10-02")).toBe(true);
    expect(buildCsv([s])).toBe(
      `${HEADER}\r\n2026-10-03,00:30,01:35,1h 05m,65\r\n`,
    );
  });

  it("skips sessions with unreadable times and never shows NaN", () => {
    const bad: WorkSession = {
      id: "bad",
      startTime: "nope",
      endTime: "nope",
      durationMinutes: Number.NaN,
    };
    const csv = buildCsv([bad, session(2026, 9, 1, 9, 0, 0)]);
    expect(csv).toBe(`${HEADER}\r\n2026-10-01,09:00,09:00,0h 00m,0\r\n`);
    expect(csv).not.toContain("NaN");
  });
});

describe("escapeCsvField", () => {
  it("leaves safe values alone", () => {
    expect(escapeCsvField("8h 00m")).toBe("8h 00m");
    expect(escapeCsvField("")).toBe("");
  });

  it("quotes commas, quotes, and line breaks", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
    expect(escapeCsvField("a\r\nb")).toBe('"a\r\nb"');
  });
});

describe("csvFileName", () => {
  it("names the file after the month", () => {
    expect(csvFileName("2026-10")).toBe("work-sessions-2026-10.csv");
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("clicks a temporary download link and revokes the URL afterwards", () => {
    vi.useFakeTimers();
    const link = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
      remove: vi.fn(),
    };
    const appendChild = vi.fn();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadCsv("a,b\r\n", "work-sessions-2026-10.csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe("text/csv;charset=utf-8");
    expect(link.href).toBe("blob:test");
    expect(link.download).toBe("work-sessions-2026-10.csv");
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
