import {
  formatOptionalDuration,
  formatPace,
  formatPercent,
  type MonthPace,
  type PaceStatus,
  type Progress,
} from "@/lib/progress";
import { formatDuration } from "@/lib/time";
import { GaugeIcon } from "./icons";

interface ProgressCardProps {
  today: Progress;
  week: Progress;
  month: Progress;
  pace: MonthPace;
}

// Full class strings, so Tailwind can find them in the source.
const PACE_BADGE: Record<PaceStatus, string> = {
  ahead: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  "on-track": "bg-sky-50 text-sky-800 ring-sky-600/20",
  behind: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

const BAR_FILL: Record<"sky" | "violet" | "amber", string> = {
  sky: "from-sky-400 to-cyan-400",
  violet: "from-violet-400 to-fuchsia-400",
  amber: "from-amber-400 to-orange-400",
};

function ProgressRow({
  label,
  progress,
  color,
}: {
  label: string;
  progress: Progress;
  color: keyof typeof BAR_FILL;
}) {
  const percentText = formatPercent(progress.percent);
  // The bar stops at full; the text can show more than 100%.
  const width = Math.min(100, Math.max(0, progress.percent ?? 0));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="ml-auto text-sm tabular-nums text-slate-600">
          <span className="font-semibold text-slate-900">
            {formatDuration(progress.workedMinutes)}
          </span>{" "}
          / {formatDuration(progress.targetMinutes)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${percentText} of target`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        className="h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${BAR_FILL[color]} transition-[width] duration-500`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-slate-500">
        <span>{percentText}</span>
        <span className="ml-auto">
          {progress.targetMinutes > 0 && progress.remainingMinutes === 0
            ? "Target reached"
            : `${formatDuration(progress.remainingMinutes)} left`}
        </span>
      </div>
    </div>
  );
}

// Daily, weekly, and monthly progress plus the month's pace (§10).
// UI only: all numbers come from src/lib/progress.ts.
export default function ProgressCard({
  today,
  week,
  month,
  pace,
}: ProgressCardProps) {
  const rows = [
    { label: "Expected by now", value: formatDuration(pace.expectedMinutes) },
    {
      label: "Needed per day",
      value: formatOptionalDuration(pace.neededPerDayMinutes),
    },
    {
      label: "Month-end projection",
      value: formatOptionalDuration(pace.projectedMinutes),
    },
    {
      label: "Days off left",
      value: `${pace.daysOffLeft} of ${pace.daysOffAllowed}`,
    },
    ...(pace.missedDays > 0
      ? [{ label: "Missed days", value: String(pace.missedDays) }]
      : []),
  ];

  return (
    <section
      aria-labelledby="progress-heading"
      className="flex flex-col gap-5 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/15">
          <GaugeIcon />
        </div>
        <h2
          id="progress-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Progress
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ProgressRow label="Today" progress={today} color="sky" />
        <ProgressRow label="This Week" progress={week} color="violet" />
        <ProgressRow label="This Month" progress={month} color="amber" />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Pace this month
          </h3>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ring-1 ${PACE_BADGE[pace.status]}`}
          >
            {formatPace(pace)}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap justify-between gap-x-3"
            >
              <dt className="text-slate-600">{row.label}</dt>
              <dd className="ml-auto whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
