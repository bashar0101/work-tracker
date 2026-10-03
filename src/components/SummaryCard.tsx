export interface SummaryRow {
  label: string;
  value: string; // already formatted
}

interface SummaryCardProps {
  title: string;
  rows: SummaryRow[];
}

// One card for Today, This Week, and This Month. The first row is the
// main number and is shown large. UI only: values come in formatted.
export default function SummaryCard({ title, rows }: SummaryCardProps) {
  const [main, ...rest] = rows;

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {main && (
        <div>
          <p className="text-3xl font-semibold tabular-nums text-gray-900">
            {main.value}
          </p>
          <p className="text-sm text-gray-500">{main.label}</p>
        </div>
      )}
      {rest.length > 0 && (
        <dl className="flex flex-col gap-1 border-t border-gray-100 pt-3 text-sm">
          {rest.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap justify-between gap-x-3"
            >
              <dt className="text-gray-600">{row.label}</dt>
              <dd className="ml-auto whitespace-nowrap text-right font-medium tabular-nums text-gray-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
