import type { TrackerStatus } from "@/hooks/useWorkTracker";

interface WorkControlsProps {
  status: TrackerStatus;
  onStart: () => void;
  onEnd: () => void;
}

const BASE =
  "min-h-12 w-full rounded-lg px-6 py-3 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 sm:w-auto sm:min-w-64";

export default function WorkControls({
  status,
  onStart,
  onEnd,
}: WorkControlsProps) {
  if (status === "loading") {
    // A neutral placeholder: never a clickable Start button before load.
    return (
      <div className="flex justify-center">
        <button
          type="button"
          disabled
          aria-busy="true"
          className={`${BASE} cursor-not-allowed bg-gray-200 text-gray-500`}
        >
          Loading…
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
            ? `${BASE} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300 active:bg-red-800`
            : `${BASE} bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-300 active:bg-green-800`
        }
      >
        {working ? "End Work" : "Start Work"}
      </button>
    </div>
  );
}
