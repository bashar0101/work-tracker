import {
  formatOptionalDuration,
  formatPace,
  formatPercent,
  type MonthPace,
  type PaceStatus,
  type Progress,
} from "@/lib/progress";
import { formatDuration } from "@/lib/time";
import { useI18n } from "./I18n";
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
  const { locale, m } = useI18n();
  const percentText = formatPercent(progress.percent);
  // The bar stops at full; the text can show more than 100%.
  const width = Math.min(100, Math.max(0, progress.percent ?? 0));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="ms-auto text-sm tabular-nums text-slate-600">
          <span className="font-semibold text-slate-900">
            {formatDuration(progress.workedMinutes, locale)}
          </span>{" "}
          / {formatDuration(progress.targetMinutes, locale)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={m.progress.ofTarget(label, percentText)}
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
        <span className="ms-auto">
          {progress.targetMinutes > 0 && progress.remainingMinutes === 0
            ? m.progress.targetReached
            : m.progress.left(formatDuration(progress.remainingMinutes, locale))}
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
  const { locale, m } = useI18n();
  const p = m.progress;
  const rows = [
    { label: p.expected, value: formatDuration(pace.expectedMinutes, locale) },
    {
      label: p.neededPerDay,
      value: formatOptionalDuration(pace.neededPerDayMinutes, locale),
    },
    {
      label: p.projection,
      value: formatOptionalDuration(pace.projectedMinutes, locale),
    },
    {
      label: p.daysOffLeft,
      value: p.daysOffValue(pace.daysOffLeft, pace.daysOffAllowed),
    },
    ...(pace.missedDays > 0
      ? [{ label: p.missedDays, value: String(pace.missedDays) }]
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
          {p.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <ProgressRow label={m.cards.today} progress={today} color="sky" />
        <ProgressRow label={m.cards.thisWeek} progress={week} color="violet" />
        <ProgressRow label={m.cards.thisMonth} progress={month} color="amber" />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            {p.paceTitle}
          </h3>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ring-1 ${PACE_BADGE[pace.status]}`}
          >
            {formatPace(pace, locale)}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap justify-between gap-x-3"
            >
              <dt className="text-slate-600">{row.label}</dt>
              <dd className="ms-auto whitespace-nowrap text-end font-semibold tabular-nums text-slate-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
