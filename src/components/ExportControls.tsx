import { formatMonthKey } from "@/lib/time";

interface ExportControlsProps {
  /** `YYYY-MM` keys of months with sessions, newest first. */
  months: string[];
  /** The month shown in the picker, or `null` when there are no months. */
  selectedMonth: string | null;
  onSelectMonth: (monthKey: string) => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  /** True while the PDF is being created: the PDF button is disabled. */
  pdfBusy: boolean;
  /** Shown inline when the PDF could not be created. */
  pdfError: string | null;
  /** True until storage has loaded: controls stay disabled, no hint. */
  loading?: boolean;
}

const BUTTON =
  "min-h-12 w-full rounded-lg px-5 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 sm:w-auto";

// Month picker and export buttons. UI only: the month list and the
// selected month come in; actions go out through callbacks.
export default function ExportControls({
  months,
  selectedMonth,
  onSelectMonth,
  onExportCsv,
  onExportPdf,
  pdfBusy,
  pdfError,
  loading = false,
}: ExportControlsProps) {
  const empty = loading || months.length === 0 || selectedMonth === null;

  return (
    <section
      aria-label="Export"
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <label
            htmlFor="export-month"
            className="text-sm font-semibold text-gray-700"
          >
            Month:
          </label>
          <select
            id="export-month"
            value={selectedMonth ?? ""}
            disabled={empty}
            onChange={(event) => onSelectMonth(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 sm:w-auto sm:min-w-48"
          >
            {empty ? (
              <option value="">-</option>
            ) : (
              months.map((key) => (
                <option key={key} value={key}>
                  {formatMonthKey(key)}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          disabled={empty}
          className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-300 active:bg-blue-800`}
        >
          Export CSV
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={empty || pdfBusy}
          className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-300 active:bg-blue-800`}
        >
          {pdfBusy ? "Creating PDF…" : "Export PDF"}
        </button>
      </div>

      {empty && !loading && (
        <p className="text-sm text-gray-500">No sessions to export yet.</p>
      )}

      {pdfError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {pdfError}
        </p>
      )}
    </section>
  );
}
