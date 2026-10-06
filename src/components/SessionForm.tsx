"use client";

import { useState, type FormEvent } from "react";
import { readSessionForm, type SessionFormValues } from "@/lib/sessionEdit";
import { formatDuration } from "@/lib/time";
import { useI18n } from "./I18n";
import { AlertIcon } from "./icons";

interface SessionFormProps {
  title: string;
  initialValues: SessionFormValues;
  /** Saves the values. Returns an error message, or `null` on success. */
  onSave: (values: SessionFormValues) => string | null;
  onCancel: () => void;
}

const FIELD =
  "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base font-medium tabular-nums text-slate-900 shadow-sm transition hover:border-slate-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";

const LABEL = "text-xs font-semibold uppercase tracking-wider text-slate-600";

// Add or edit one completed session (PROJECT_PLAN.md §11). UI only: reading
// and checking the values happens in src/lib/sessionEdit.ts.
export default function SessionForm({
  title,
  initialValues,
  onSave,
  onCancel,
}: SessionFormProps) {
  const { locale, m } = useI18n();
  const t = m.form;
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

  // Live preview of the duration while typing.
  const preview = readSessionForm(values);

  function update(field: keyof SessionFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(onSave(values));
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="session-form-heading"
      className="flex flex-col gap-4 rounded-xl bg-indigo-50/60 p-4 ring-1 ring-indigo-600/15 sm:p-5"
    >
      <h3
        id="session-form-heading"
        className="text-base font-semibold text-slate-900"
      >
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-date" className={LABEL}>
            {t.date}
          </label>
          <input
            id="session-date"
            type="date"
            required
            autoFocus
            value={values.date}
            onChange={(event) => update("date", event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-start" className={LABEL}>
            {t.start}
          </label>
          <input
            id="session-start"
            type="time"
            required
            value={values.start}
            onChange={(event) => update("start", event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-end" className={LABEL}>
            {t.end}
          </label>
          <input
            id="session-end"
            type="time"
            required
            value={values.end}
            onChange={(event) => update("end", event.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <p aria-live="polite" className="text-sm tabular-nums text-slate-700">
        {preview.ok ? (
          <>
            {t.duration}{" "}
            <span className="font-semibold text-slate-900">
              {formatDuration(preview.times.durationMinutes, locale)}
            </span>
            {preview.times.endsNextDay && ` · ${t.endsNextDay}`}
          </>
        ) : (
          `${t.duration} -`
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
        >
          {t.save}
        </button>
      </div>
    </form>
  );
}
