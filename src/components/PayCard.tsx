"use client";

import { useState, type FormEvent } from "react";
import {
  CURRENCIES,
  formatMoney,
  isCurrency,
  parseRateInput,
  rateInputText,
  rateToCents,
} from "@/lib/earnings";
import type { Currency } from "@/lib/types";
import { AlertIcon, BanknoteIcon, ChevronDownIcon, InfoIcon } from "./icons";

interface PayCardProps {
  /** The saved rate, or `null` when none is set. */
  hourlyRate: number | null;
  currency: Currency;
  /** Saves a valid rate. Returns false when the write failed. */
  onSaveRate: (rate: number) => boolean;
  onChangeCurrency: (currency: Currency) => void;
  /** True until storage has loaded: inputs stay disabled. */
  loading?: boolean;
}

const RATE_ERROR = "Enter a rate between 0 and 100000 with up to 2 decimals.";

const FIELD =
  "min-h-12 w-full rounded-xl border border-slate-200 bg-white py-2 text-base font-medium text-slate-900 shadow-sm transition hover:border-slate-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none";

const LABEL = "text-xs font-semibold uppercase tracking-wider text-slate-600";

// Hourly rate and currency (PROJECT_PLAN.md §9). UI only: parsing and
// formatting come from src/lib. The parent gives this component a `key`
// based on the saved rate, so the input text starts over when the rate
// changes (also from another tab), without an effect.
export default function PayCard({
  hourlyRate,
  currency,
  onSaveRate,
  onChangeCurrency,
  loading = false,
}: PayCardProps) {
  const [rateText, setRateText] = useState(() => rateInputText(hourlyRate));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const rate = parseRateInput(rateText);
    if (rate === null) {
      setError(RATE_ERROR);
      return;
    }
    setError(null);
    onSaveRate(rate);
  }

  return (
    <section
      aria-labelledby="pay-heading"
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/15">
          <BanknoteIcon />
        </div>
        <h2
          id="pay-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Pay
        </h2>
        {!loading && hourlyRate !== null && (
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-600/15">
            {formatMoney(rateToCents(hourlyRate), currency)} / hour
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex flex-col gap-1.5 sm:min-w-48 sm:flex-1">
          <label htmlFor="pay-rate" className={LABEL}>
            Hourly rate
          </label>
          <input
            id="pay-rate"
            name="hourlyRate"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={rateText}
            disabled={loading}
            aria-invalid={error !== null}
            aria-describedby={error ? "pay-rate-error" : "pay-rate-hint"}
            onChange={(event) => {
              setRateText(event.target.value);
              setError(null);
            }}
            className={`${FIELD} px-4 tabular-nums`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-currency" className={LABEL}>
            Currency
          </label>
          <div className="relative">
            <select
              id="pay-currency"
              value={currency}
              disabled={loading}
              onChange={(event) => {
                const value = event.target.value;
                if (isCurrency(value)) onChangeCurrency(value);
              }}
              className={`${FIELD} cursor-pointer appearance-none pr-11 pl-4 sm:w-32`}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-emerald-500/25 transition duration-200 hover:from-emerald-700 hover:to-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 active:from-emerald-800 active:to-teal-800 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
        >
          Save
        </button>
      </form>

      {error && (
        <p
          id="pay-rate-error"
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </p>
      )}

      <div id="pay-rate-hint" className="flex flex-col gap-1 text-sm">
        {!loading && hourlyRate === null && (
          <p className="flex items-center gap-2 font-medium text-slate-700">
            <InfoIcon className="size-4 shrink-0 text-emerald-600" />
            Set your hourly rate to see earnings.
          </p>
        )}
        <p className="text-slate-500">
          New sessions use this rate. Past sessions keep theirs.
        </p>
      </div>
    </section>
  );
}
