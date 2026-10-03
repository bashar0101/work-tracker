import type { ReactNode } from "react";
import type { TrackerStatus } from "@/hooks/useWorkTracker";
import { formatTime } from "@/lib/time";
import type { ActiveSession } from "@/lib/types";
import { ClockIcon } from "./icons";
import Timer from "./Timer";

interface StatusCardProps {
  status: TrackerStatus;
  activeSession: ActiveSession | null;
}

const CARD =
  "relative overflow-hidden rounded-3xl p-6 text-center ring-1 transition-colors duration-500 sm:p-8";

export default function StatusCard({ status, activeSession }: StatusCardProps) {
  let content: ReactNode;
  let tone: string;

  if (status === "loading") {
    tone = "bg-white/80 shadow-card ring-slate-900/5 backdrop-blur";
    content = (
      <div className="flex flex-col items-center gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-widest text-slate-600">
          Loading…
        </p>
        <div
          aria-hidden="true"
          className="h-12 w-48 animate-pulse rounded-xl bg-slate-200/70 motion-reduce:animate-none sm:h-14 sm:w-60"
        />
      </div>
    );
  } else if (status === "working" && activeSession) {
    tone =
      "bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-lg shadow-emerald-500/10 ring-emerald-500/20";
    content = (
      <div className="flex flex-col items-center gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold tracking-widest text-emerald-800 ring-1 ring-emerald-600/20">
          <span aria-hidden="true" className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          WORKING
        </p>
        <Timer startTime={activeSession.startTime} />
        <p className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <ClockIcon className="size-4 text-emerald-600" />
          Started at {formatTime(new Date(activeSession.startTime))}
        </p>
      </div>
    );
  } else {
    tone = "bg-white/80 shadow-card ring-slate-900/5 backdrop-blur";
    content = (
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-900/5">
          <ClockIcon className="size-6" />
        </div>
        <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-widest text-slate-700">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-slate-400"
          />
          NOT WORKING
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Work status" className={`${CARD} ${tone}`}>
      {status === "working" && activeSession && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-emerald-300/20 blur-3xl"
        />
      )}
      <div className="relative">{content}</div>
    </section>
  );
}
