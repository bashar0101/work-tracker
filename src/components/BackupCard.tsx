"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { RestoreErrorCode } from "@/hooks/useWorkTracker";
import {
  checkBackupSize,
  parseBackup,
  summarizeSessions,
  type BackupErrorCode,
  type ParsedBackup,
} from "@/lib/backup";
import type { Locale } from "@/lib/i18n";
import { dateFromKey } from "@/lib/statistics";
import { formatDate } from "@/lib/time";
import type { AppData } from "@/lib/types";
import {
  AlertIcon,
  ArchiveIcon,
  DownloadIcon,
  InfoIcon,
  UploadIcon,
} from "./icons";
import { useI18n } from "./I18n";

interface BackupCardProps {
  /** Number of sessions stored now, for the restore warning. */
  currentSessionCount: number;
  /** True while a session is running: restore is blocked. */
  working: boolean;
  /** True until storage has loaded: buttons stay disabled. */
  loading?: boolean;
  onDownload: () => void;
  /** Replaces all data. Returns an error code, or `null` on success. */
  onRestore: (data: AppData) => RestoreErrorCode | null;
}

const BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none disabled:ring-slate-200 sm:w-auto";

const SECONDARY = `${BUTTON} bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:ring-indigo-200`;

type BackupError = BackupErrorCode | RestoreErrorCode | "read-error";

function dateText(key: string | null, locale: Locale): string {
  const date = key === null ? null : dateFromKey(key);
  return date ? formatDate(date, locale) : "";
}

// Download all data as a JSON file, and restore it (PROJECT_PLAN.md §12).
// UI only: building and checking the file happens in src/lib/backup.ts.
export default function BackupCard({
  currentSessionCount,
  working,
  loading = false,
  onDownload,
  onRestore,
}: BackupCardProps) {
  const { locale, m } = useI18n();
  const t = m.backup;
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<BackupError | null>(null);
  /** Number of sessions restored, shown as a success message. */
  const [restored, setRestored] = useState<number | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Clear the input, so picking the same file again still works.
    event.target.value = "";
    if (!file) return;
    setPending(null);
    setRestored(null);

    const sizeError = checkBackupSize(file.size);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("read-error");
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setPending(result.backup);
  }

  function handleConfirm(): void {
    if (!pending) return;
    const code = onRestore(pending);
    if (code) {
      setError(code);
      return;
    }
    setRestored(pending.sessions.length);
    setPending(null);
  }

  const summary = pending ? summarizeSessions(pending.sessions) : null;

  return (
    <section
      aria-labelledby="backup-heading"
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-600/15">
          <ArchiveIcon />
        </div>
        <h2
          id="backup-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {t.title}
        </h2>
      </div>

      <p className="text-sm text-slate-600">
        {t.intro}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onDownload}
          disabled={loading}
          className={SECONDARY}
        >
          <DownloadIcon />
          {t.download}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={loading || working}
          className={SECONDARY}
        >
          <UploadIcon />
          {t.restore}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {!loading && working && (
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-indigo-600" />
          <span>{t.workingHint}</span>
        </p>
      )}

      {pending && summary && (
        <div
          role="alertdialog"
          aria-labelledby="restore-heading"
          aria-describedby="restore-text"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <h3 id="restore-heading" className="font-semibold text-amber-900">
            {t.confirmTitle}
          </h3>
          <div id="restore-text" className="flex flex-col gap-1 text-sm text-amber-900">
            <p className="tabular-nums">
              {t.preview(
                m.sessions(summary.count),
                summary.firstDateKey && summary.lastDateKey
                  ? `${dateText(summary.firstDateKey, locale)} – ${dateText(summary.lastDateKey, locale)}`
                  : null,
                m.sessions(currentSessionCount),
              )}
            </p>
            {pending.skippedSessions > 0 && (
              <p>{t.skipped(pending.skippedSessions)}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPending(null)}
              className={SECONDARY}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`${BUTTON} bg-amber-600 text-white shadow-md shadow-amber-500/25 hover:bg-amber-700 focus-visible:ring-amber-300`}
            >
              {t.confirm}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <span>
            {error === "read-error" ? t.readError : t.errors[error]}
          </span>
        </p>
      )}

      {restored !== null && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {t.restored(m.sessions(restored))}
        </p>
      )}
    </section>
  );
}
