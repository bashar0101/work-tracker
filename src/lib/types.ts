export interface WorkSession {
  id: string;
  startTime: string; // ISO timestamp from toISOString()
  endTime: string; // ISO timestamp
  durationMinutes: number; // Math.round((end - start) / 60_000)
  hourlyRate?: number; // rate when the session ended (§9); missing = use the current rate
}

export interface ActiveSession {
  startTime: string; // ISO timestamp
}

export type Currency = "TRY" | "USD" | "EUR" | "GBP";

export interface PaySettings {
  hourlyRate: number | null; // null = not set yet
  currency: Currency;
}

/** Everything a backup holds (§12). The running session is not included. */
export interface AppData {
  sessions: WorkSession[];
  paySettings: PaySettings;
  workTargets: WorkTargets;
}

export interface WorkTargets {
  dailyHours: number; // more than 0, up to 24, up to 2 decimals (8.5 = 8h 30m)
  daysOffPerMonth: number; // whole number, 0 to 10
}
