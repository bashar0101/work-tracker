// The only bridge between React and storage (PROJECT_PLAN.md Phase 3).
// Import it only from client components.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createSession } from "@/lib/sessions";
import {
  addSessionFromForm,
  removeSession,
  SESSION_ERROR_MESSAGES,
  updateSessionFromForm,
  type SessionEditResult,
  type SessionFormValues,
} from "@/lib/sessionEdit";
import {
  clearActiveSession,
  getActiveSession,
  getPaySettings,
  getSessions,
  parseActiveSession,
  parsePaySettings,
  parseSessions,
  parseWorkTargets,
  readActiveSessionRaw,
  readPaySettingsRaw,
  readSessionsRaw,
  readWorkTargetsRaw,
  saveActiveSession,
  savePaySettings as storePaySettings,
  saveSessions,
  saveWorkTargets as storeWorkTargets,
  subscribeToStorage,
} from "@/lib/storage";
import type {
  ActiveSession,
  PaySettings,
  WorkSession,
  WorkTargets,
} from "@/lib/types";

export type TrackerStatus = "loading" | "working" | "idle";

export interface WorkTracker {
  status: TrackerStatus;
  activeSession: ActiveSession | null;
  sessions: WorkSession[];
  startWork: () => void;
  endWork: () => void;
  /** Hourly rate and currency (§9). Defaults until storage has loaded. */
  paySettings: PaySettings;
  /** Saves the pay settings. Returns false (and sets `error`) on failure. */
  savePaySettings: (settings: PaySettings) => boolean;
  /** Hours per day and days off per month (§10). Defaults until loaded. */
  workTargets: WorkTargets;
  /** Saves the targets. Returns false (and sets `error`) on failure. */
  saveWorkTargets: (targets: WorkTargets) => boolean;
  /** Adds a session from the form (§11). Returns an error message or `null`. */
  addSession: (values: SessionFormValues) => string | null;
  /** Changes a session's times (§11). Returns an error message or `null`. */
  updateSession: (id: string, values: SessionFormValues) => string | null;
  /** Deletes a session. Returns false (and sets `error`) on failure. */
  deleteSession: (id: string) => boolean;
  error: string | null;
}

const SAVE_ERROR =
  "Could not save. Your browser storage may be full or blocked.";

/** Saves a successful edit. Returns an error message or `null`. */
function saveEdit(result: SessionEditResult): string | null {
  if (!result.ok) return SESSION_ERROR_MESSAGES[result.error];
  return saveSessions(result.sessions) ? null : SAVE_ERROR;
}

function noopSubscribe(): () => void {
  return () => {};
}

// Server and hydration render: false ("not loaded yet"). Client: true.
// This keeps "not loaded yet" separate from "storage is empty".
const getLoadedClient = () => true;
const getLoadedServer = () => false;
const getRawServer = () => null;

export function useWorkTracker(): WorkTracker {
  const loaded = useSyncExternalStore(
    noopSubscribe,
    getLoadedClient,
    getLoadedServer,
  );
  // Snapshots are raw strings (primitives), so they are stable between calls.
  const sessionsRaw = useSyncExternalStore(
    subscribeToStorage,
    readSessionsRaw,
    getRawServer,
  );
  const activeRaw = useSyncExternalStore(
    subscribeToStorage,
    readActiveSessionRaw,
    getRawServer,
  );

  const payRaw = useSyncExternalStore(
    subscribeToStorage,
    readPaySettingsRaw,
    getRawServer,
  );
  const targetsRaw = useSyncExternalStore(
    subscribeToStorage,
    readWorkTargetsRaw,
    getRawServer,
  );

  const sessions = useMemo(() => parseSessions(sessionsRaw), [sessionsRaw]);
  const paySettings = useMemo(() => parsePaySettings(payRaw), [payRaw]);
  const workTargets = useMemo(
    () => parseWorkTargets(targetsRaw),
    [targetsRaw],
  );
  const activeSession = useMemo(
    () => parseActiveSession(activeRaw),
    [activeRaw],
  );

  const [error, setError] = useState<string | null>(null);

  const startWork = useCallback(() => {
    // Another tab may have started already: never overwrite it.
    // The store shows the existing session.
    if (getActiveSession()) {
      setError(null);
      return;
    }
    const ok = saveActiveSession({ startTime: new Date().toISOString() });
    setError(ok ? null : SAVE_ERROR);
  }, []);

  const endWork = useCallback(() => {
    const active = getActiveSession();
    if (!active) {
      setError(null);
      return;
    }
    // Re-read the rate now: the session keeps the rate set when it ends.
    const session = createSession(
      active,
      new Date(),
      getPaySettings().hourlyRate,
    );
    // Save the session first, then clear the active one,
    // so a failed write can never lose a session.
    if (!saveSessions([...getSessions(), session])) {
      setError(SAVE_ERROR);
      return;
    }
    setError(clearActiveSession() ? null : SAVE_ERROR);
  }, []);

  const savePaySettings = useCallback((settings: PaySettings): boolean => {
    const ok = storePaySettings(settings);
    setError(ok ? null : SAVE_ERROR);
    return ok;
  }, []);

  const saveWorkTargets = useCallback((targets: WorkTargets): boolean => {
    const ok = storeWorkTargets(targets);
    setError(ok ? null : SAVE_ERROR);
    return ok;
  }, []);

  // Edits re-read storage first, so another tab's changes are never lost
  // or overlapped. Rule errors show in the form; only a failed write also
  // sets the page error.
  const addSession = useCallback((values: SessionFormValues) => {
    const message = saveEdit(
      addSessionFromForm(
        getSessions(),
        values,
        getActiveSession(),
        new Date(),
        getPaySettings().hourlyRate,
      ),
    );
    setError(message === SAVE_ERROR ? SAVE_ERROR : null);
    return message;
  }, []);

  const updateSession = useCallback(
    (id: string, values: SessionFormValues) => {
      const message = saveEdit(
        updateSessionFromForm(
          getSessions(),
          id,
          values,
          getActiveSession(),
          new Date(),
        ),
      );
      setError(message === SAVE_ERROR ? SAVE_ERROR : null);
      return message;
    },
    [],
  );

  const deleteSession = useCallback((id: string): boolean => {
    const ok = saveSessions(removeSession(getSessions(), id));
    setError(ok ? null : SAVE_ERROR);
    return ok;
  }, []);

  let status: TrackerStatus = "loading";
  if (loaded) status = activeSession ? "working" : "idle";

  return {
    status,
    activeSession,
    sessions,
    startWork,
    endWork,
    paySettings,
    savePaySettings,
    workTargets,
    saveWorkTargets,
    addSession,
    updateSession,
    deleteSession,
    error,
  };
}
