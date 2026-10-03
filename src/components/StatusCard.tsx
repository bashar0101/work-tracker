import type { ReactNode } from "react";
import type { TrackerStatus } from "@/hooks/useWorkTracker";
import { formatTime } from "@/lib/time";
import type { ActiveSession } from "@/lib/types";
import Timer from "./Timer";

interface StatusCardProps {
  status: TrackerStatus;
  activeSession: ActiveSession | null;
}

export default function StatusCard({ status, activeSession }: StatusCardProps) {
  let content: ReactNode;

  if (status === "loading") {
    content = (
      <p className="text-sm font-semibold tracking-wide text-gray-500">
        Loading…
      </p>
    );
  } else if (status === "working" && activeSession) {
    content = (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold tracking-wide text-green-700">
          WORKING
        </p>
        <Timer startTime={activeSession.startTime} />
        <p className="text-sm text-gray-600">
          Started at {formatTime(new Date(activeSession.startTime))}
        </p>
      </div>
    );
  } else {
    content = (
      <p className="text-sm font-bold tracking-wide text-gray-600">
        NOT WORKING
      </p>
    );
  }

  return (
    <section
      aria-label="Work status"
      className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
    >
      {content}
    </section>
  );
}
