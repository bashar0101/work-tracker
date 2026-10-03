// Hourly rate and earnings (PROJECT_PLAN.md §9). Nothing here reads the clock.
//
// Money is kept in integer cents. A rate has at most 2 decimals, so it is
// turned into whole cents first: `Math.round(rate * 100)`. That keeps the
// §9 formula `Math.round(durationMinutes × rate × 100 / 60)` exact and free
// of floating-point surprises like 10.05 * 100 = 1004.9999…
//
// Formats are built by hand (no `toLocaleString()`), so the output is the
// same in every browser language and safe for jsPDF's built-in font.

import { NO_VALUE } from "./time";
import type { Currency, WorkSession } from "./types";

export const CURRENCIES: readonly Currency[] = ["TRY", "USD", "EUR", "GBP"];

export const DEFAULT_CURRENCY: Currency = "TRY";

/** The highest hourly rate the Pay card accepts. */
export const MAX_HOURLY_RATE = 100_000;

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}

/** A usable rate: a finite number, 0 or more. */
function isUsableRate(rate: number | null | undefined): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate >= 0;
}

/** A rate in whole cents, e.g. 25.5 → 2550. */
export function rateToCents(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * The rate a session uses: its stored `hourlyRate`, otherwise the current
 * rate, otherwise `null` (earnings unknown).
 */
export function effectiveRate(
  session: WorkSession,
  currentRate: number | null,
): number | null {
  if (isUsableRate(session.hourlyRate)) return session.hourlyRate;
  if (isUsableRate(currentRate)) return currentRate;
  return null;
}

/** Earnings of one session in cents, or `null` when no rate applies. */
export function sessionEarningsCents(
  session: WorkSession,
  currentRate: number | null,
): number | null {
  const rate = effectiveRate(session, currentRate);
  if (rate === null) return null;
  const minutes =
    Number.isFinite(session.durationMinutes) && session.durationMinutes > 0
      ? session.durationMinutes
      : 0;
  return Math.round((minutes * rateToCents(rate)) / 60);
}

/**
 * Sum of the sessions that have a rate, in cents. `null` when none of them
 * has one (including no sessions at all).
 */
export function totalEarningsCents(
  sessions: WorkSession[],
  currentRate: number | null,
): number | null {
  let total: number | null = null;
  for (const session of sessions) {
    const cents = sessionEarningsCents(session, currentRate);
    if (cents === null) continue;
    total = (total ?? 0) + cents;
  }
  return total;
}

/**
 * Live earnings while working: elapsed whole seconds × rate, rounded to
 * cents. Never negative or NaN: bad input gives 0.
 */
export function liveEarningsCents(elapsedMs: number, rate: number): number {
  if (!isUsableRate(rate)) return 0;
  const seconds =
    Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;
  return Math.round((seconds * rateToCents(rate)) / 3600);
}

/** `1234567` → `1,234,567`. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Cents as `whole` and 2-digit `fraction` strings, or `null` if unusable. */
function splitCents(cents: number | null): { sign: string; whole: string; fraction: string } | null {
  if (cents === null || !Number.isFinite(cents)) return null;
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  return {
    sign: rounded < 0 ? "-" : "",
    whole: String(Math.floor(abs / 100)),
    fraction: String(abs % 100).padStart(2, "0"),
  };
}

/** `1,250.00 TRY`, or `-` when the amount is unknown. */
export function formatMoney(cents: number | null, currency: Currency): string {
  const parts = splitCents(cents);
  if (!parts) return NO_VALUE;
  return `${parts.sign}${groupThousands(parts.whole)}.${parts.fraction} ${currency}`;
}

/** Plain number for CSV: `212.50`, no thousands separator. Empty when unknown. */
export function formatCsvMoney(cents: number | null): string {
  const parts = splitCents(cents);
  if (!parts) return "";
  return `${parts.sign}${parts.whole}.${parts.fraction}`;
}

/** A rate for CSV: `25.00`. Empty when there is none. */
export function formatCsvRate(rate: number | null): string {
  return isUsableRate(rate) ? formatCsvMoney(rateToCents(rate)) : "";
}

/** A saved rate as text for the Pay card input: `25`, `25.5`. Empty for none. */
export function rateInputText(rate: number | null): string {
  return isUsableRate(rate) ? String(rate) : "";
}

/**
 * The Pay card input as a rate, or `null` when it is invalid. Accepts
 * `25`, `25.5`, `25.50`, and a comma decimal like `25,50`. Rejects
 * negatives, more than 2 decimals, values above MAX_HOURLY_RATE, and text.
 */
export function parseRateInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const rate = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_HOURLY_RATE) return null;
  return rate;
}
