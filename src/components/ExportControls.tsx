import { formatMonthKey } from "@/lib/time";
import {
  AlertIcon,
  ChevronDownIcon,
  DocumentIcon,
  DownloadIcon,
  InfoIcon,
} from "./icons";

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
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none disabled:ring-slate-200 sm:w-auto";

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
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5 sm:mr-auto">
          <label
            htmlFor="export-month"
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            Month:
          </label>
          <div className="relative">
            <select
              id="export-month"
              value={selectedMonth ?? ""}
              disabled={empty}
              onChange={(event) => onSelectMonth(event.target.value)}
              className="min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-11 pl-4 text-base font-medium text-slate-900 shadow-sm transition hover:border-slate-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none sm:w-auto sm:min-w-56"
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
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          disabled={empty}
          className={`${BUTTON} bg-white text-slate-800 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-indigo-200 active:bg-slate-100`}
        >
          <DownloadIcon className="size-5" />
          Export CSV
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={empty || pdfBusy}
          className={`${BUTTON} bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-500/30 focus-visible:ring-indigo-300 active:from-indigo-800 active:to-violet-800`}
        >
          <DocumentIcon className="size-5" />
          {pdfBusy ? "Creating PDF…" : "Export PDF"}
        </button>
      </div>

      {empty && !loading && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <InfoIcon className="size-4 shrink-0 text-slate-400" />
          No sessions to export yet.
        </p>
      )}

      {pdfError && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <span>{pdfError}</span>
        </p>
      )}
    </section>
  );
}
