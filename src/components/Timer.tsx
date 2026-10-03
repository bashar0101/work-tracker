"use client";

import { useCallback, useSyncExternalStore } from "react";
import { formatTimer } from "@/lib/time";

interface TimerProps {
  startTime: string;
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

export default function Timer({ startTime }: TimerProps) {
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
    <p
      role="timer"
      aria-live="off"
      className="font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-7xl"
    >
      {formatTimer(elapsedMs)}
    </p>
  );
}
