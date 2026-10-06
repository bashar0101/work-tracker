"use client";

import { useMemo, useState } from "react";
import { formatMoney, sessionEarningsCents } from "@/lib/earnings";
import type { SaveErrorCode } from "@/hooks/useWorkTracker";
import type { Locale } from "@/lib/i18n";
import {
  sessionToFormValues,
  type SessionErrorCode,
  type SessionFormValues,
} from "@/lib/sessionEdit";
import { sortNewestFirst } from "@/lib/sessions";
import {
  formatDate,
  formatDuration,
  formatEndTime,
  formatTime,
  toDateKey,
} from "@/lib/time";
import type { Currency, WorkSession } from "@/lib/types";
import { Ltr, useI18n } from "./I18n";
import { HistoryIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";
import SessionForm from "./SessionForm";

interface SessionHistoryProps {
  sessions: WorkSession[];
  /** Used for sessions without a stored rate (§9). */
  currentRate: number | null;
  currency: Currency;
  loading?: boolean;
  /** Adds a session (§11). Returns an error code or `null`. */
  onAdd: (values: SessionFormValues) => EditError | null;
  /** Changes a session's times (§11). Returns an error code or `null`. */
  onUpdate: (id: string, values: SessionFormValues) => EditError | null;
  /** Deletes a session (§11). */
  onDelete: (id: string) => void;
}

type EditError = SessionErrorCode | SaveErrorCode;

interface HistoryRow {
  session: WorkSession;
  id: string;
  date: string;
  start: string;
  end: string;
  duration: string;
  earnings: string;
}

type FormState =
  | null
  | { mode: "add"; values: SessionFormValues }
  | { mode: "edit"; id: string; values: SessionFormValues };

function toRow(
  session: WorkSession,
  currentRate: number | null,
  currency: Currency,
  locale: Locale,
): HistoryRow {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return {
    session,
    id: session.id,
    date: formatDate(start, locale),
    start: formatTime(start),
    end: formatEndTime(start, end),
    duration: formatDuration(session.durationMinutes, locale),
    earnings: formatMoney(sessionEarningsCents(session, currentRate), currency),
  };
}

const ICON_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200";

const SMALL_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4";

interface RowActionsProps {
  row: HistoryRow;
  confirming: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

// Edit and Delete, or the inline delete confirmation.
function RowActions({
  row,
  confirming,
  onEdit,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: RowActionsProps) {
  const { m } = useI18n();
  const h = m.history;
  const label = `${row.date} ${row.start}`;
  if (confirming) {
    return (
      <div
        role="group"
        aria-label={h.deleteGroupLabel(label)}
        className="flex flex-wrap items-center justify-end gap-2"
      >
        <span className="text-sm font-medium text-rose-800">
          {h.confirmDelete}
        </span>
        <button
          type="button"
          onClick={onConfirmDelete}
          className={`${SMALL_BUTTON} bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300`}
        >
          {h.delete}
        </button>
        <button
          type="button"
          onClick={onCancelDelete}
          className={`${SMALL_BUTTON} bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:ring-indigo-200`}
        >
          {h.cancel}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={h.editLabel(label)}
        title={h.edit}
        className={ICON_BUTTON}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={onAskDelete}
        aria-label={h.deleteLabel(label)}
        title={h.delete}
        className={`${ICON_BUTTON} hover:bg-rose-50 hover:text-rose-700`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// Completed sessions, newest first. A table from `md`, stacked rows below.
// Sessions can be added, edited, and deleted (§11). UI only: sorting,
// formatting, and the rules come from src/lib.
export default function SessionHistory({
  sessions,
  currentRate,
  currency,
  loading = false,
  onAdd,
  onUpdate,
  onDelete,
}: SessionHistoryProps) {
  const { locale, m } = useI18n();
  const h = m.history;
  const rows = useMemo(
    () =>
      sortNewestFirst(sessions).map((session) =>
        toRow(session, currentRate, currency, locale),
      ),
    [sessions, currentRate, currency, locale],
  );

  const [form, setForm] = useState<FormState>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function openAdd(): void {
    // Reading the clock in an event handler is fine (not during render).
    setForm({
      mode: "add",
      values: { date: toDateKey(new Date()), start: "", end: "" },
    });
    setConfirmId(null);
  }

  function openEdit(session: WorkSession): void {
    setForm({ mode: "edit", id: session.id, values: sessionToFormValues(session) });
    setConfirmId(null);
  }

  function handleSave(values: SessionFormValues): string | null {
    if (!form) return null;
    const code =
      form.mode === "add" ? onAdd(values) : onUpdate(form.id, values);
    if (code === null) {
      setForm(null);
      return null;
    }
    return code === "save-failed" ? m.saveFailed : m.form.errors[code];
  }

  function confirmDelete(id: string): void {
    setConfirmId(null);
    if (form?.mode === "edit" && form.id === id) setForm(null);
    onDelete(id);
  }

  function actionsFor(row: HistoryRow) {
    return (
      <RowActions
        row={row}
        confirming={confirmId === row.id}
        onEdit={() => openEdit(row.session)}
        onAskDelete={() => setConfirmId(row.id)}
        onConfirmDelete={() => confirmDelete(row.id)}
        onCancelDelete={() => setConfirmId(null)}
      />
    );
  }

  let content;
  if (loading) {
    content = (
      <p className="animate-pulse text-sm text-slate-500 motion-reduce:animate-none">
        {h.loading}
      </p>
    );
  } else if (rows.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-900/5">
          <HistoryIcon className="size-6" />
        </div>
        <p className="text-sm text-slate-600">
          {h.empty}
        </p>
      </div>
    );
  } else {
    content = (
      <>
        <ul className="-mx-2 flex flex-col divide-y divide-slate-100 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 rounded-lg px-2 py-3">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.date}
                  </p>
                  <p className="text-sm tabular-nums text-slate-600">
                    <Ltr>{row.start}</Ltr> – <Ltr>{row.end}</Ltr>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-indigo-700">
                    {row.duration}
                  </span>
                  <span className="whitespace-nowrap text-sm tabular-nums text-slate-600">
                    <span className="sr-only">{h.earningsPrefix}</span>
                    {row.earnings}
                  </span>
                </div>
              </div>
              {actionsFor(row)}
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-xl ring-1 ring-slate-200/70 md:block">
          <table className="w-full text-start text-sm tabular-nums">
            <thead className="bg-slate-50/80">
              <tr className="text-start text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {h.date}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {h.start}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {h.end}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {h.duration}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {h.earnings}
                </th>
                <th scope="col" className="px-2 py-3">
                  <span className="sr-only">{h.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/60">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {row.date}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    <Ltr>{row.start}</Ltr>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    <Ltr>{row.end}</Ltr>
                  </td>
                  <td className="px-4 py-2 text-end font-semibold whitespace-nowrap text-slate-900">
                    {row.duration}
                  </td>
                  <td className="px-4 py-2 text-end whitespace-nowrap text-slate-700">
                    {row.earnings}
                  </td>
                  <td className="px-2 py-1">{actionsFor(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <section
      aria-labelledby="session-history-heading"
      className="flex flex-col gap-4 rounded-2xl bg-white/80 p-5 shadow-card ring-1 ring-slate-900/5 backdrop-blur sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/15">
          <HistoryIcon />
        </div>
        <h2
          id="session-history-heading"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {h.title}
        </h2>
        {!loading && rows.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-900/5">
            {rows.length}
          </span>
        )}
        {!loading && (
          <button
            type="button"
            onClick={openAdd}
            disabled={form?.mode === "add"}
            className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-600/20 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="size-4" />
            {h.add}
          </button>
        )}
      </div>

      {form && (
        <SessionForm
          key={form.mode === "edit" ? form.id : "add"}
          title={form.mode === "add" ? m.form.addTitle : m.form.editTitle}
          initialValues={form.values}
          onSave={handleSave}
          onCancel={() => setForm(null)}
        />
      )}

      {content}
    </section>
  );
}
