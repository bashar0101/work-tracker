import type { Locale } from "@/lib/i18n";
import { useI18n } from "./I18n";

interface LanguageSwitchProps {
  onChange: (locale: Locale) => void;
}

// Each button is labelled in its own language, so anyone can find theirs.
const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "ar", label: "عربي" },
];

// The EN | عربي switch (PROJECT_PLAN.md §13). The chosen one is pressed.
export default function LanguageSwitch({ onChange }: LanguageSwitchProps) {
  const { locale, m } = useI18n();
  return (
    <div
      role="group"
      aria-label={m.language}
      className="flex shrink-0 rounded-xl bg-white/80 p-1 shadow-sm ring-1 ring-slate-900/5"
    >
      {OPTIONS.map((option) => {
        const active = option.locale === locale;
        return (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            aria-pressed={active}
            onClick={() => onChange(option.locale)}
            className={`min-h-10 min-w-12 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
