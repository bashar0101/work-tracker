"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MESSAGES, type Locale, type Messages } from "@/lib/i18n";

interface I18nValue {
  locale: Locale;
  /** Messages for `locale` (PROJECT_PLAN.md §13). */
  m: Messages;
}

const I18nContext = createContext<I18nValue>({ locale: "en", m: MESSAGES.en });

/** Gives every component below it the chosen language. */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, m: MESSAGES[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The chosen language and its messages. */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/**
 * Keeps times, ranges, and `HH:mm (+1)` left to right inside Arabic text,
 * so colons and `(+1)` don't flip.
 */
export function Ltr({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" className="inline-block">
      {children}
    </span>
  );
}
