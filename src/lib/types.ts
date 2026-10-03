export interface WorkSession {
  id: string;
  startTime: string; // ISO timestamp from toISOString()
  endTime: string; // ISO timestamp
  durationMinutes: number; // Math.round((end - start) / 60_000)
}

export interface ActiveSession {
  startTime: string; // ISO timestamp
}
