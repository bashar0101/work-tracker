import type { ReactNode } from "react";

export interface SummaryRow {
  label: string;
  value: string; // already formatted
}

export type SummaryAccent = "sky" | "violet" | "amber";

interface SummaryCardProps {
  title: string;
  rows: SummaryRow[];
  /** Decorative icon shown in a colored badge next to the title. */
  icon?: ReactNode;
  /** Accent color of the icon badge and the top stripe. */
  accent?: SummaryAccent;
}

// Full class strings, so Tailwind can find them in the source.
const ACCENTS: Record<SummaryAccent, { badge: string; stripe: string }> = {
  sky: {
    badge: "bg-sky-100 text-sky-700 ring-sky-600/15",
    stripe: "from-sky-400 to-cyan-400",
  },
  violet: {
    badge: "bg-violet-100 text-violet-700 ring-violet-600/15",
    stripe: "from-violet-400 to-fuchsia-400",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 ring-amber-600/15",
    stripe: "from-amber-400 to-orange-400",
  },
};

// One card for Today, This Week, and This Month. The first row is the
// main number and is shown large. UI only: values come in formatted.
export default function SummaryCard({
  title,
  rows,
  icon,
  accent = "sky",
}: SummaryCardProps) {
  const [main, ...rest] = rows;
  const colors = ACCENTS[accent];

  return (
    <section
      aria-label={title}
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transform-none sm:p-6"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${colors.stripe}`}
      />
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${colors.badge}`}
          >
            {icon}
          </div>
        )}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </h2>
      </div>
      {main && (
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-4xl">
            {main.value}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{main.label}</p>
        </div>
      )}
      {rest.length > 0 && (
        <dl className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm">
          {rest.map((row) => (
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
      )}
    </section>
  );
}
