"use client";

import { useState, type FormEvent } from "react";
import {
  dailyTargetMinutes,
  parseDailyHoursInput,
  parseDaysOffInput,
} from "@/lib/progress";
import { formatDuration } from "@/lib/time";
import type { WorkTargets } from "@/lib/types";
import { AlertIcon, TargetIcon } from "./icons";

interface TargetsCardProps {
  /** The saved targets. */
  targets: WorkTargets;
  /** Saves valid targets. Returns false when the write failed. */
  onSave: (targets: WorkTargets) => boolean;
  /** True until storage has loaded: inputs stay disabled. */
  loading?: boolean;
}

const HOURS_ERROR = "Enter hours per day from 0.01 to 24, with up to 2 decimals.";
const DAYS_OFF_ERROR = "Enter days off per month as a whole number from 0 to 10.";

const FIELD =
  "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base font-medium tabular-nums text-slate-900 shadow-sm transition hover:border-slate-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none";

const LABEL = "text-xs font-semibold uppercase tracking-wider text-slate-600";

// Hours per day and days off per month (PROJECT_PLAN.md §10). UI only:
// parsing comes from src/lib. The parent gives this component a `key`
// based on the saved targets, so the inputs start over when they change
// (also from another tab), without an effect.
export default function TargetsCard({
  targets,
  onSave,
  loading = false,
}: TargetsCardProps) {
  const [hoursText, setHoursText] = useState(() => String(targets.dailyHours));
  const [daysOffText, setDaysOffText] = useState(() =>
    String(targets.daysOffPerMonth),
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const dailyHours = parseDailyHoursInput(hoursText);
    if (dailyHours === null) {
      setError(HOURS_ERROR);
      return;
    }
    const daysOffPerMonth = parseDaysOffInput(daysOffText);
    if (daysOffPerMonth === null) {
      setError(DAYS_OFF_ERROR);
      return;
    }
    setError(null);
    onSave({ dailyHours, daysOffPerMonth });
  }

  return (
    <section
      aria-labelledby="targets-heading"
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/15">
          <TargetIcon />
        </div>
        <h2
          id="targets-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Targets
        </h2>
        {!loading && (
          <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-indigo-800 ring-1 ring-indigo-600/15">
            {formatDuration(dailyTargetMinutes(targets))} / day ·{" "}
            {targets.daysOffPerMonth} off / month
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex flex-col gap-1.5 sm:min-w-40 sm:flex-1">
          <label htmlFor="target-hours" className={LABEL}>
            Hours per day
          </label>
          <input
            id="target-hours"
            name="dailyHours"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={hoursText}
            disabled={loading}
            aria-invalid={error === HOURS_ERROR}
            aria-describedby={error ? "targets-error" : "targets-hint"}
            onChange={(event) => {
              setHoursText(event.target.value);
              setError(null);
            }}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:min-w-40 sm:flex-1">
          <label htmlFor="target-days-off" className={LABEL}>
            Days off per month
          </label>
          <input
            id="target-days-off"
            name="daysOffPerMonth"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={daysOffText}
            disabled={loading}
            aria-invalid={error === DAYS_OFF_ERROR}
            aria-describedby={error ? "targets-error" : "targets-hint"}
            onChange={(event) => {
              setDaysOffText(event.target.value);
              setError(null);
            }}
            className={FIELD}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition duration-200 hover:from-indigo-700 hover:to-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 active:from-indigo-800 active:to-violet-800 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
        >
          Save
        </button>
      </form>

      {error && (
        <p
          id="targets-error"
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </p>
      )}

      <p id="targets-hint" className="text-sm text-slate-500">
        Days with no work count as days off automatically, up to this number
        each month.
      </p>
    </section>
  );
}
