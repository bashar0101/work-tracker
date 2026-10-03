// The only bridge between React and storage (PROJECT_PLAN.md Phase 3).
// Import it only from client components.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createSession } from "@/lib/sessions";
import {
  clearActiveSession,
  getActiveSession,
  getSessions,
  parseActiveSession,
  parseSessions,
  readActiveSessionRaw,
  readSessionsRaw,
  saveActiveSession,
  saveSessions,
  subscribeToStorage,
} from "@/lib/storage";
import type { ActiveSession, WorkSession } from "@/lib/types";

export type TrackerStatus = "loading" | "working" | "idle";

export interface WorkTracker {
  status: TrackerStatus;
  activeSession: ActiveSession | null;
  sessions: WorkSession[];
  startWork: () => void;
  endWork: () => void;
  error: string | null;
}

const SAVE_ERROR =
  "Could not save. Your browser storage may be full or blocked.";

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

  const sessions = useMemo(() => parseSessions(sessionsRaw), [sessionsRaw]);
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
    const session = createSession(active, new Date());
    // Save the session first, then clear the active one,
    // so a failed write can never lose a session.
    if (!saveSessions([...getSessions(), session])) {
      setError(SAVE_ERROR);
      return;
    }
    setError(clearActiveSession() ? null : SAVE_ERROR);
  }, []);

  let status: TrackerStatus = "loading";
  if (loaded) status = activeSession ? "working" : "idle";

  return { status, activeSession, sessions, startWork, endWork, error };
}
