"use client";

import { useCallback, useSyncExternalStore } from "react";
import { formatMoney, liveEarningsCents } from "@/lib/earnings";
import { formatTimer } from "@/lib/time";
import type { Currency } from "@/lib/types";
import { BanknoteIcon } from "./icons";

interface TimerProps {
  startTime: string;
  /** Current hourly rate. `null` hides "Earned so far". */
  hourlyRate: number | null;
  currency: Currency;
}

// The only 1-second tick in the app. It lives here, so the rest of the
// page does not re-render every second.
function subscribeToClock(callback: () => void): () => void {
  const id = window.setInterval(callback, 1000);
  // Refresh right away when the tab comes back from the background.
  document.addEventListener("visibilitychange", callback);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", callback);
  };
}

// Whole seconds: a primitive that stays the same within one second.
function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export default function Timer({ startTime, hourlyRate, currency }: TimerProps) {
  const startMs = Date.parse(startTime);
  const getServerSeconds = useCallback(
    () => Math.floor(startMs / 1000),
    [startMs],
  );
  const nowSeconds = useSyncExternalStore(
    subscribeToClock,
    getNowSeconds,
    getServerSeconds,
  );

  // Recomputed from the stored timestamp on every tick. Not a counter.
  const elapsedMs = nowSeconds * 1000 - startMs;

  return (
    <div className="flex flex-col items-center gap-2">
      <p
        role="timer"
        aria-live="off"
        className="font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-7xl"
      >
        {formatTimer(elapsedMs)}
      </p>
      {hourlyRate !== null && (
        <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full bg-white/70 px-3 py-1 text-sm ring-1 ring-emerald-600/15">
          <BanknoteIcon className="size-4 text-emerald-600" />
          <span className="text-slate-600">Earned so far</span>
          <span className="font-semibold tabular-nums text-emerald-800">
            {formatMoney(liveEarningsCents(elapsedMs, hourlyRate), currency)}
          </span>
        </p>
      )}
    </div>
  );
}
