import type { TrackerStatus } from "@/hooks/useWorkTracker";
import { useI18n } from "./I18n";
import { PlayIcon, StopIcon } from "./icons";

interface WorkControlsProps {
  status: TrackerStatus;
  onStart: () => void;
  onEnd: () => void;
}

const BASE =
  "inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl px-8 py-3 text-lg font-semibold tracking-tight transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:w-auto sm:min-w-72";

const ACTIVE =
  "text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none";

export default function WorkControls({
  status,
  onStart,
  onEnd,
}: WorkControlsProps) {
  const { m } = useI18n();
  if (status === "loading") {
    // A neutral placeholder: never a clickable Start button before load.
    return (
      <div className="flex justify-center">
        <button
          type="button"
          disabled
          aria-busy="true"
          className={`${BASE} cursor-not-allowed bg-slate-200 text-slate-600`}
        >
          {m.loading}
        </button>
      </div>
    );
  }

  const working = status === "working";

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={working ? onEnd : onStart}
        className={
          working
            ? `${BASE} ${ACTIVE} bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-500/30 hover:from-rose-700 hover:to-red-700 hover:shadow-rose-500/40 focus-visible:ring-rose-300 active:from-rose-800 active:to-red-800`
            : `${BASE} ${ACTIVE} bg-gradient-to-r from-emerald-700 to-teal-700 shadow-emerald-600/30 hover:from-emerald-800 hover:to-teal-800 hover:shadow-emerald-600/40 focus-visible:ring-emerald-300 active:from-emerald-900 active:to-teal-900`
        }
      >
        {working ? (
          <StopIcon className="size-5" />
        ) : (
          <PlayIcon className="size-5" />
        )}
        {working ? m.controls.end : m.controls.start}
      </button>
    </div>
  );
}
