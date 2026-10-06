# Work Hours Tracker — Spec & Build Plan

- **Part 1 — Spec** is the single source of truth for how the app behaves.
- **Part 2 — Phases** is the build order. Do one phase at a time.
- Rules for code, tests, and workflow are in `CLAUDE.md`.

## Progress
- [x] Phase 1 — Project setup and time helpers
- [x] Phase 2 — Storage layer
- [x] Phase 3 — Start, end, and live timer
- [x] Phase 4 — Statistics
- [x] Phase 5 — Session history
- [x] Phase 6 — Month picker and CSV export
- [x] Phase 7 — PDF export
- [x] Phase 8 — Polish and final check
- [x] Phase 9 — Hourly rate and earnings
- [x] Phase 10 — Hour targets, progress, and pace
- [ ] Phase 11 — Edit, delete, and add sessions
- [ ] Phase 12 — Backup and restore (JSON)
- [ ] Phase 13 — Overtime
- [ ] Phase 14 — Notes on sessions
- [ ] Phase 15 — Mark days off by hand
- [ ] Phase 16 — Reminders
- [ ] Phase 17 — Charts

---

# Part 1 — Spec

## 1. Scope

**Build:** start and end work sessions, a live timer, daily/weekly/monthly statistics, session history, monthly CSV and PDF export, an hourly rate with earnings (§9), daily/weekly/monthly hour targets with progress and pace (§10), localStorage persistence, a mobile-friendly UI.

**Don't build unless I ask:** backend, API, database, auth, cloud sync or backup, multiple users or jobs, taxes, currency conversion, PWA, dark mode. (Editing sessions and overtime moved into scope: §11, Phase 13.)

## 2. Data model

```ts
// src/lib/types.ts
export interface WorkSession {
  id: string;
  startTime: string;       // ISO timestamp from toISOString()
  endTime: string;         // ISO timestamp
  durationMinutes: number; // Math.round((end - start) / 60_000)
  hourlyRate?: number;     // rate when the session ended (§9); missing = use the current rate
}

export interface ActiveSession {
  startTime: string;       // ISO timestamp
}
```

**Separate** localStorage keys:

| Key | Value | If missing |
|---|---|---|
| `work_sessions` | JSON array of `WorkSession` | no sessions yet (`[]`) |
| `active_work_session` | JSON `ActiveSession` | not working |
| `pay_settings` | JSON `PaySettings` (§9) | no rate set, currency `TRY` |
| `work_targets` | JSON `WorkTargets` (§10) | 10 hours a day, 2 days off a month |

- Invalid JSON counts as missing. Invalid items inside the array are skipped; valid ones are kept. Bad data never crashes the app.
- IDs: use `crypto.randomUUID()` when it exists, otherwise a fallback. It doesn't exist on plain-HTTP addresses, such as `http://192.168.1.20:3000` when you test on a phone.

## 3. Behavior

**Start Work**
1. Re-read `active_work_session`. If it exists (for example, started in another tab), show it. Never overwrite it.
2. Otherwise save `{ startTime: now }`. Status becomes Working, and the button becomes End Work.

**End Work**
1. Re-read `active_work_session`. If there is none, do nothing.
2. Create a `WorkSession` with `endTime = now` and add it to `work_sessions`.
3. Then remove `active_work_session`. In this order, a failed write can't lose a session.
4. Status becomes Not Working. Stats and history update.

**Live timer**
- Shows `now − startTime`, recalculated every second from the stored timestamp. Not a counter that adds 1.
- Stays correct after a refresh, after the tab was in the background, and when another tab starts or ends the session.

**Loading and errors**
- Until storage has been read, show a neutral loading state, never a clickable Start button.
- If a localStorage write fails (storage full, private mode), show an inline error. The app stays usable.
- If PDF generation fails, show an inline error.

## 4. Formats

Use these everywhere: UI, CSV, and PDF. Times use the device's time zone. Text is always English with normal digits (0–9), whatever the browser language is.

| Value | Format | Examples |
|---|---|---|
| Date | `DD Mon YYYY` | `03 Oct 2026` |
| Time | `HH:mm`, 24-hour | `09:05` |
| End time on a later day (UI and PDF only) | `HH:mm (+N)` | `06:00 (+1)` |
| Duration | hours, then 2-digit minutes | `8h 05m`, `0h 00m`, `126h 40m` |
| Live timer | `HH:MM:SS` | `04:32:18`, `25:03:00` |
| Date in CSV | `YYYY-MM-DD` (local date) | `2026-10-03` |
| Month | `Month YYYY` | `October 2026` |
| No value | `-` | average when there are 0 working days |

Durations and the timer can go past 24 hours. Format them from minutes or milliseconds, never through a `Date` object.

## 5. Statistics

- Only completed sessions count. A running session counts after it ends.
- A session counts fully for the local date of its `startTime`, even if it ends after midnight. A 22:00–06:00 shift belongs to the start day. Never split sessions.
- Working day: a local date with at least one completed session.
- Week: Monday to Sunday, local time. Note: `getDay()` returns 0 for Sunday.
- Month: calendar month, local time.
- Total: sum of `durationMinutes`.
- Daily average: total ÷ working days, rounded to the nearest minute. With 0 working days, show `-`.
- Longest day: the date with the highest daily total (all of that day's sessions added up), not the longest single session. Show the date and the total.

| Card | Shows |
|---|---|
| Today | total, number of sessions |
| This Week | total, working days, daily average |
| This Month | total, working days, daily average, longest day |

## 6. UI

One page, mobile-first:

```text
Work Hours Tracker
──────────────────────────────────────────────
WORKING                        (or: NOT WORKING)
04:32:18                       (only while working)
Started at 09:15               (only while working)
[            End Work            ]   (or: Start Work)
──────────────────────────────────────────────
[ Today ]   [ This Week ]   [ This Month ]
──────────────────────────────────────────────
Month: [ October 2026 ▾ ]   [ Export CSV ]   [ Export PDF ]
──────────────────────────────────────────────
Session History
Date          Start   End          Duration
03 Oct 2026   22:00   06:00 (+1)   8h 00m
02 Oct 2026   09:00   17:30        8h 30m
```

- Main button: full width on mobile and at least 48px tall (`min-h-12`). All buttons and the month picker are easy to tap.
- Summary cards: stacked on mobile, 3 columns from the `md` breakpoint. One reusable `SummaryCard` for all three.
- History: newest first. A table from `md`; stacked rows on smaller screens. No horizontal page scroll at 375px width.
- Empty states: history shows "No sessions yet. Press Start Work to begin." Cards show `0h 00m` or `-`, never blank or `NaN`.

Components: `Dashboard` (client root), `StatusCard`, `Timer`, `WorkControls`, `SummaryCard`, `ExportControls`, `SessionHistory`.

## 7. Exports

Both exports use the month chosen in the month picker. Everything is generated in the browser.

**Month picker**
- Options: months with at least one completed session, newest first.
- Default: the current month if it has sessions, otherwise the latest month that has sessions.
- No sessions at all: both export buttons are disabled, with the hint "No sessions to export yet."

**CSV** — file name `work-sessions-YYYY-MM.csv`

The chosen month's sessions, oldest first:

```csv
Date,Start Time,End Time,Duration,Duration Minutes
2026-10-01,09:00,18:00,9h 00m,540
2026-10-02,22:00,06:00,8h 00m,480
```

- End Time is plain `HH:mm`, without `(+1)`. Duration Minutes is the exact value.
- Download with a `Blob` and a temporary `<a download>` link. Revoke the object URL afterwards.

**PDF** — file name `work-report-YYYY-MM.pdf`
1. Title `Work Hours Report - October 2026`, and the date and time it was generated.
2. Month summary: total, working days, daily average, longest day. Use the same functions as the dashboard.
3. Table `Date | Start | End | Duration` with the chosen month's sessions, oldest first. Long tables continue on the next page.

jsPDF's built-in fonts can't show Turkish letters like ş, ğ, ı, or Arabic text. The fixed English formats in §4 keep all PDF text safe.


## 8. Languages
The UI, CSV, and PDF text stays English (§4). The app must work correctly when the browser or phone language is Arabic, Turkish, or English: same date and time formats, normal digits (0–9), and a PDF without broken characters. No translation and no language switcher.



## 9. Hourly rate and earnings

```ts
// src/lib/types.ts
export type Currency = "TRY" | "USD" | "EUR" | "GBP";
export interface PaySettings {
  hourlyRate: number | null; // null = not set yet
  currency: Currency;
}
```

**Settings**
- A "Pay" card has an hourly rate input (number, ≥ 0, up to 2 decimals, max 100000) and a currency picker (TRY, USD, EUR, GBP). Default: no rate, `TRY`.
- Save the rate with a Save button (and Enter). An invalid value shows an inline error and is not saved. The currency saves when it changes.
- The rate can be changed any time.

**Which rate a session uses**
- When End Work creates a session and a rate is set, the session stores that rate in `hourlyRate`. A later rate change does not change it.
- A session without `hourlyRate` (made before this feature, or while no rate was set) uses the current rate.
- If no rate applies (no stored rate and no current rate), its earnings are unknown: show `-`, never `0` or `NaN`.
- The currency is one global setting for display only. Changing it does not convert amounts.

**Calculation**
- Session earnings in cents: `Math.round(durationMinutes × rate × 100 / 60)`. Work in integer cents; totals are sums of session cents.
- Totals (Today, This Week, This Month, PDF) add up the sessions that have a rate. If some sessions in the period have no rate, the total covers only the ones that do; if none do, show `-`.
- Live while working: `Earned so far` under the timer = elapsed seconds × current rate, rounded to cents, updated with the timer. Hidden when no rate is set.

**Money format** (UI, CSV, PDF): `1,250.00 TRY` — comma thousands separator, dot decimals, 2 decimals, then a space and the currency code. Built by hand, never `toLocaleString()`. Currency codes, not symbols: jsPDF's built-in font can't draw `₺`.

**Where earnings show**
- Summary cards: an `Earnings` row on Today, This Week, and This Month.
- Session history: an `Earnings` column (table) and on each mobile row.
- CSV: three more columns: `Date,Start Time,End Time,Duration,Duration Minutes,Hourly Rate,Earnings,Currency`. `Hourly Rate` and `Earnings` are plain numbers with 2 decimals and no thousands separator (`25.00`, `212.50`), so spreadsheets read them as numbers. Empty cells when no rate applies.
- PDF: an `Earnings` line in the month summary, and an `Earnings` column in the table.

## 10. Hour targets, progress, and pace

The employee should work a set number of hours every day, with a few days off per month. Defaults: **10 hours a day, 2 days off a month.**

```ts
// src/lib/types.ts
export interface WorkTargets {
  dailyHours: number;      // more than 0, up to 24, up to 2 decimals (8.5 = 8h 30m)
  daysOffPerMonth: number; // whole number, 0 to 10
}
```

**Settings**
- A "Targets" card with two inputs: `Hours per day` and `Days off per month`, and a Save button (and Enter). An invalid value shows an inline error and nothing is saved.
- Invalid stored data falls back to the defaults, field by field.
- Changing the targets changes all progress and pace right away, also for the past.

**Targets** (all in minutes; daily minutes = `Math.round(dailyHours × 60)`)
- Day: daily target. 10h by default.
- Week (Monday–Sunday): always 7 × daily target, 70h by default. Days off do not lower it.
- Month: (days in the month − days off per month) × daily target. The month length matters: Feb 2026 (28 days) = 26 × 10h = 260h, April (30) = 280h, October (31) = 290h. Leap years count: Feb 2028 has 29 days → 270h.

**Progress** (Today, This Week, This Month)
- Worked = the same totals as §5 (completed sessions only; a running session counts after it ends).
- Shows worked / target, percent, and time left.
- Percent = `Math.round(worked ÷ target × 100)`. It can go above 100%; the bar stops at full. With a target of 0, show `-`.
- Left = target − worked, never below 0. At 0, show "Target reached".

**Days off are automatic.** Nothing has to be marked.
- Past days = days of the current month before today. Today is still in progress, so it never counts as a day off.
- A past day with no work time (`0h 00m`, for example no sessions or only an accidental 0-minute one) is a day off, up to the monthly allowance.
- Empty past days beyond the allowance are **missed days**. They are not days off; they count against the target.
- `Days off left` = allowance − days off used.

**Pace analysis** (current month only, from `now`)
- Expected by now = (past days − days off used) × daily target. Today is not expected yet, so work done today puts you ahead.
- Difference = month worked − expected by now.
  - Within ±30 minutes: `On track`.
  - More: `Ahead by 4h 30m`. Less: `Behind by 4h 30m`.
- Work days left = days from today to the end of the month (today included) − days off left. Never below 0.
- Needed per day = (monthly target − month worked) ÷ work days left, rounded **up** to the minute. If the target is already reached: `0h 00m`. If work days left is 0 but hours are still missing: `-`.
- Month-end projection = past worked + (past worked ÷ past work days) × work days left. Past work days = past days − days off used. Never less than month worked. With 0 past work days (for example on the 1st): `-`.
- Also shown: `Days off left: N of M`, and `Missed days: N` when N > 0.

**UI**
- A "Progress" card below the summary cards: three progress bars (Today, This Week, This Month), then the pace block.
- The "Targets" card sits next to the Pay card.
- Progress uses the same minute clock as the summary cards, so it changes at midnight.
- Formats from §4. Never `NaN`. Progress and pace are not in the CSV or PDF.

## 11. Edit, delete, and add sessions

Fixes mistakes: a forgotten End Work, an accidental start, or a session the employee forgot to record. Only completed sessions can be changed; the running session can't.

**The session form** (used for both Add and Edit)
- Fields: `Date` (date picker), `Start` (time picker), `End` (time picker), and Save / Cancel buttons.
- If End is earlier than Start, the session ends the next day. The form shows "Ends next day (+1)" and the duration live, e.g. `Duration: 8h 00m`.
- Times are whole minutes. Editing a session rounds its times down to the minute.

**Rules** (checked when saving; an error shows inline and nothing is saved)
- Date, Start, and End must be filled in and valid.
- End must not equal Start. (So the longest session is 23h 59m.)
- The session must not end in the future.
- It must not overlap another completed session (touching is fine: one ends 12:00, the next starts 12:00).
- It must not overlap the running session: it must end before the running session's start.

**Which rate**
- Edit keeps the session's stored `hourlyRate`. Only the times change.
- Add stores the current rate when one is set, like End Work (§9).

**Delete**
- Asks inline first: "Delete this session?" with Delete and Cancel. No browser `confirm()`. No undo.

**Storage**
- Every change re-reads `work_sessions` first and checks the rules against that fresh list, so another tab's changes are never lost or overlapped.
- A failed write shows the usual inline error.

**UI**
- Session History gets an `Add session` button in its header, and `Edit` and `Delete` buttons on every row (table and mobile rows). Buttons are at least 44px tall to tap easily.
- The form opens at the top of Session History. Only one form at a time.
- Stats, progress, exports, and history update right away after a change.

---

# Part 2 — Phases

Every phase ends the same way (see CLAUDE.md → Workflow): `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass → manual checks → stop and wait for my OK.

## Phase 1 — Project setup and time helpers
- [x] If there is no `package.json`, scaffold with create-next-app: TypeScript, ESLint, Tailwind, App Router, `src/` directory, `@/*` alias, AGENTS.md, npm. Pass every option as a flag plus `--yes`, so it never waits for input. This folder already has files, so scaffold into a temporary folder and move the result here. Keep this `CLAUDE.md`: the generated one only contains `@AGENTS.md`, which this file already imports.
- [x] Remove the template's demo content from `page.tsx` and `globals.css`, including its dark-mode color variables. Dark mode is out of scope, and those variables make text hard to read on phones that use dark mode.
- [x] Install Vitest and add the script `"test": "vitest run"`. Set `TZ` to `Europe/Istanbul` in the Vitest config, not in the npm script (inline env vars don't work in npm scripts on Windows). A non-UTC time zone makes UTC-vs-local bugs fail the tests.
- [x] `src/lib/types.ts` with the interfaces from §2.
- [x] `src/lib/time.ts` with tests: local date key, start of day/week/month, and every formatter from §4.

Tests must include:
- 00:30 local time gets that day's key, not the previous day (which UTC would give).
- A Sunday belongs to the week that started on the Monday before it.
- `formatDuration`: 0 → `0h 00m`, 65 → `1h 05m`, 7600 → `126h 40m`.
- Timer format for 25 hours → `25:00:00`.

**Done when:** the four commands pass, and http://localhost:3000 shows a page titled "Work Hours Tracker".

## Phase 2 — Storage layer
- [x] `src/lib/storage.ts`: `getSessions`, `saveSessions`, `getActiveSession`, `saveActiveSession`, `clearActiveSession`, plus readers that return the raw stored strings (the hook needs them in Phase 3).
- [x] Parsing and validation are pure functions (for example `parseSessions(raw: string | null)`), so they can be tested without a browser.
- [x] Writes catch errors and return success or failure. They never throw into the UI.
- [x] After every write, dispatch a custom `window` event, so the same tab can update. (The `storage` event only fires in other tabs.)

Tests must include: `null`, empty string, invalid JSON, JSON that is not an array, an array with some invalid items (the valid ones are kept), and a valid round trip.

**Done when:** the four commands pass.

## Phase 3 — Start, end, and live timer
- [x] `src/lib/sessions.ts` with tests: `createSession(active, now)` and the ID helper from §2. Cover duration rounding and a session that crosses midnight.
- [x] `src/hooks/useWorkTracker.ts`:
  - Reads storage with `useSyncExternalStore`. The server snapshot means "not loaded yet", and it must be different from "storage is empty".
  - `getSnapshot` returns the raw stored strings (stable values). Parse them with `useMemo`. If `getSnapshot` returns a new object on every call, React re-renders forever.
  - Subscribes to the `storage` event (other tabs) and to the custom event from Phase 2 (same tab).
  - Returns `status` (`loading` | `working` | `idle`), `activeSession`, `sessions`, `startWork`, `endWork`, and `error`.
- [x] Components: `Dashboard` (`"use client"`), `StatusCard`, `Timer`, `WorkControls`.

**Done when:** the four commands pass.

**Manual checks:**
1. Start Work → the timer counts up from `00:00:00`, and "Started at" shows the right time.
2. Refresh → still Working, and the timer continues from the right value.
3. Refresh several times → never a flash of "Not Working" or a Start button.
4. End Work → Not Working. In DevTools → Application → Local Storage, the session is in `work_sessions` and `active_work_session` is gone.
5. Two tabs: start in tab A → tab B switches to Working. Nothing in tab B resets tab A's timer.
6. Leave the tab in the background for 2+ minutes → the timer is correct when you come back.

## Phase 4 — Statistics
- [x] `src/lib/statistics.ts` with tests, following §5. Functions take `sessions` and `now`. The monthly function takes the month to report on, so the PDF can reuse it.
- [x] `SummaryCard` and the three cards: Today, This Week, This Month.
- [x] Update the cards' `now` every minute, so "Today" changes at midnight while the page stays open.

Tests (with a fixed `now`) must include:
- No sessions → zero totals, 0 working days, `-` average, no `NaN`.
- Two sessions on one day → 1 working day, totals added.
- Sessions on a Sunday and the next Monday → different weeks.
- A session from 23:00 to 07:00 → counts only for its start day.
- A session at 00:30 local time on the 1st → belongs to the new month.
- Longest day: two 5h sessions on one day beat one 9h session on another day.
- Daily average = total ÷ working days.

**Done when:** the four commands pass.
**Manual check:** the cards update right after End Work.

## Phase 5 — Session history
- [x] `SessionHistory` following §4 and §6: newest first, `(+1)` for sessions that end on a later day, a table from `md`, stacked rows on small screens, and the empty state.

**Done when:** the four commands pass.
**Manual checks:** load 5+ sessions with a console snippet (one of them across midnight) → order, formats, and `(+1)` are correct. At 375px width there is no horizontal scroll.

## Phase 6 — Month picker and CSV export
- [x] Month list helper in `src/lib/statistics.ts` with tests: only months with sessions, newest first, default rule from §7.
- [x] `src/lib/exportCsv.ts`: a pure `buildCsv(sessions)` with tests (exact header, oldest first, a night-shift row, §4 formats), plus the download helper.
- [x] `ExportControls`: month picker, Export CSV, Export PDF (disabled until Phase 7), and the empty state.

**Done when:** the four commands pass.
**Manual checks:** the file is named `work-sessions-YYYY-MM.csv` for the chosen month; the columns are correct in Google Sheets or Excel; the download works on a phone. (If Excel puts everything in one column, your system's list separator is `;`. Import with Data → From Text/CSV; don't change the file format.)

## Phase 7 — PDF export
- [x] `npm install jspdf jspdf-autotable`
- [x] `src/lib/exportPdf.ts`: load `jspdf` and `jspdf-autotable` with dynamic `import()` inside the export function. This keeps them off the server and out of the first page load. Use the function form: `autoTable(doc, { ... })`.
- [x] Content and file name from §7. Reuse the statistics functions and `time.ts` formatters; no new calculations.
- [x] Catch errors and show them inline.

**Done when:** the four commands pass.
**Manual checks:** the PDF opens; its numbers match the dashboard for the same month; a month with 40+ sessions continues cleanly onto page 2; the download works on a phone.

## Phase 8 — Polish and final check
- [x] Review every empty state and error message (§3, §6).
- [x] Check the layout at 375px, 768px, and 1280px.
- [x] Remove unused code, files, and dependencies. No errors or warnings in the browser console.
- [x] Go through the Definition of Done.

**Manual check on a real phone:** run `npm run build`, then `npm start`. On the same Wi-Fi, open `http://<your-PC-IP>:3000`. Repeat the Phase 3 checks, then export one CSV and one PDF.

## Phase 9 — Hourly rate and earnings
- [x] Types from §9; `WorkSession.hourlyRate` optional and validated (finite, ≥ 0) in `storage.ts`. Old sessions without it stay valid.
- [x] `storage.ts`: `pay_settings` read/parse/save (pure parser with tests; invalid → defaults), included in the storage subscription.
- [x] `src/lib/earnings.ts` with tests: session cents, effective rate (stored vs current vs none), period totals, live earnings, `formatMoney`, CSV money format.
- [x] `createSession` stores the current rate when one is set.
- [x] `useWorkTracker` exposes pay settings and a way to save them.
- [x] UI: Pay card (rate + currency), `Earnings` on the cards and in history, `Earned so far` in the timer.
- [x] CSV and PDF columns and summary from §9, with updated tests.

Tests must include: 8h 30m at 25.00 → `212.50`; rounding to the nearest cent; a session with a stored rate keeps it after the current rate changes; a session without a rate uses the current one; no rate at all → `-`; a total that mixes sessions with and without a rate; `formatMoney(125000, "TRY")` → `1,250.00 TRY`; `formatMoney(0, "USD")` → `0.00 USD`; large numbers like `1,234,567.89`.

**Done when:** the four commands pass.
**Manual checks:** set a rate → cards, history, and the live amount show earnings; change the rate → old sessions keep their amount, new ones use the new rate; CSV and PDF show the new columns and the same totals as the dashboard.

## Phase 10 — Hour targets, progress, and pace
- [x] `WorkTargets` type from §10. `daysInMonth` in `time.ts` with tests.
- [x] `storage.ts`: `work_targets` read/parse/save (pure parser with tests; invalid → defaults, field by field), included in the storage subscription.
- [x] `src/lib/progress.ts` with tests: targets per period, progress, automatic days off, pace, input parsers, and formatters.
- [x] `useWorkTracker` exposes the targets and a way to save them.
- [x] UI: `ProgressCard` (three bars + pace) and `TargetsCard` (settings).

Tests must include:
- Monthly target with defaults: 28 days → 260h, 30 → 280h, 31 → 290h, Feb 2028 (leap year) → 270h.
- Weekly target = 70h with defaults.
- Days off: 1 empty past day → 1 used, 1 left, 0 missed; 3 empty past days → 2 used, 0 left, 1 missed. Today is never a day off.
- Pace on the 1st with no work: expected 0, `On track`, projection `-`.
- Ahead, behind, and the ±30-minute on-track band.
- Needed per day is rounded up, is `0h 00m` when the target is reached, and `-` when no work days are left.
- Percent above 100%; target 0 → `-`; no `NaN` anywhere.

**Done when:** the four commands pass.
**Manual checks:** fill a month with a console snippet (some 10h days, some short days, 1–3 empty days) → bars, expected-by-now, ahead/behind, needed per day, projection, and days off match a hand calculation. Change the targets to 8h and 4 days off → everything updates. At 375px width there is no horizontal scroll.

## Phase 11 — Edit, delete, and add sessions
- [ ] `src/lib/sessionEdit.ts` with tests: read form values, build a session from them, the rules from §11 (with error codes and messages), and form values from an existing session.
- [ ] `useWorkTracker`: `addSession`, `updateSession`, `deleteSession`. Each re-reads storage first.
- [ ] UI: `SessionForm`; `Add session`, `Edit`, and `Delete` (with inline confirm) in `SessionHistory`.

Tests must include: End before Start → next day; End = Start → error; a future end → error; overlap with another session → error; touching sessions → fine; editing a session doesn't overlap with itself; overlap with the running session → error; Edit keeps `hourlyRate`; Add stores the current rate; a session across midnight gets the right date and duration.

**Done when:** the four commands pass.
**Manual checks:** add a session for yesterday → it shows in history and the cards; edit it to cross midnight → `(+1)` and the duration are right; try an overlapping time → inline error; delete it → it's gone after the confirm; with two tabs open, a change in one shows in the other.

## Phase 12 — Backup and restore (JSON)
Spec to be written before the phase starts. Download all data (sessions, pay settings, targets) as one JSON file; restore it with checks and a clear warning before replacing data.

## Phase 13 — Overtime
Spec to be written before the phase starts. Time above the daily target counts as overtime, paid at a multiplier (e.g. 1.5×). Shown on the cards, in the CSV, and in the PDF.

## Phase 14 — Notes on sessions
Spec to be written before the phase starts. An optional short note per session, set when ending or in the session form. Shown in history, CSV, and PDF.

## Phase 15 — Mark days off by hand
Spec to be written before the phase starts. Plan leave days ahead. Marked days count as days off in §10, before the automatic empty days.

## Phase 16 — Reminders
Spec to be written before the phase starts. In-app warnings: a session that runs very long ("forgot to end?"), and falling behind pace.

## Phase 17 — Charts
Spec to be written before the phase starts. Hours per day for the week and month with the target line. Hand-made SVG (no chart library).

## Definition of Done
- [ ] All phases are ticked, and the four commands pass.
- [ ] Start and End work. The timer survives a refresh, a background tab, and a second tab.
- [ ] Statistics follow §5, proven by unit tests.
- [ ] History, CSV, and PDF use the formats in §4.
- [ ] Works on a phone: big buttons, no horizontal scroll, exports download.
- [ ] Empty or invalid storage data doesn't crash the app.
- [ ] No backend code, no `any`, no dependencies beyond the allowed list.

---

## Decisions log
Add a line whenever a decision changes or extends the spec.

| Date | Decision | Reason |
|---|---|---|
| 2026-10-03 | Exports are per month, chosen in a month picker | With "current month only", last month's report can't be exported after the month ends |
| 2026-10-03 | The PDF is a monthly report (month summary + sessions); no Today/This Week sections | Today and This Week don't fit a report for a past month |
| 2026-10-03 | Vitest added (dev only) | Claude needs tests it can run to check the date logic |
| 2026-10-03 | §8 "support Arabic, Turkish, English" means the English app works in any of those browser languages; no translated UI | Keeps the fixed formats of §4 and keeps PDF text safe for jsPDF's built-in fonts |
| 2026-10-03 | Added hourly rate and earnings (§9, Phase 9); salary was out of scope before | Requested by the user. Each session keeps its own rate; currency codes, not symbols, so the PDF stays safe |
| 2026-10-04 | Added hour targets, progress, and pace (§10, Phase 10). Defaults: 10h a day, 2 days off a month, both editable | Requested by the user |
| 2026-10-04 | Days off are automatic: empty past days, up to the monthly allowance. No "mark day off" button | Chosen by the user: no extra input for the employee |
| 2026-10-04 | Weekly target is always 7 × daily target (70h); days off don't lower it | Chosen by the user |
| 2026-10-04 | App stays local-only. Added Phases 11–17: edit/delete/add, backup, overtime, notes, manual days off, reminders, charts | Chosen by the user; SaaS stays in Ideas |
| 2026-10-04 | Editing, deleting, and adding sessions is now in scope (§11); it was in "Don't build" | Requested by the user |
| 2026-10-04 | The session form uses the browser's date and time pickers. Their stored values are always `YYYY-MM-DD` and `HH:mm`; only the picker's look follows the phone language | Native pickers are much easier on phones |

## Ideas (not in scope)
Ideas that come up during the build go here, not into the code.

### Toward a paid product (SaaS)
Most of these need a backend, which the Hard rules in `CLAUDE.md` forbid today. Starting them means changing that rule on purpose, in a new version.

**Must-haves for companies**
- Accounts and roles: employee, manager, admin. Company sign-up and invite by email.
- Cloud sync across devices, so data survives a cleared browser.
- Edit and delete sessions, with an audit log (who changed what, and when).
- Approval flow: the employee submits a week or month; the manager approves or rejects it.
- Leave requests and a team calendar (turns "days off" into real requests).
- Payroll export per employee in the format accountants use.

**Worth paying for**
- Overtime rules by country, e.g. Turkey: 45h normal week, overtime at +50%. Check the exact rules with a local accountant or lawyer.
- Team dashboard: who is working now, who is behind on pace, who has missed days.
- Alerts: forgot to end a session, falling behind, overtime limit almost reached.
- Location or QR check-in to prove on-site presence.
- Kiosk mode: one shared tablet, employees check in with a PIN.
- Shifts and schedules: planned vs. actual hours, late arrivals, early leaves.
- Projects and clients: hours and earnings per project, invoice export.

**Positioning**
- Niche: industries with long shifts (security, hospitals, factories, restaurants, construction).
- Turkish and Arabic markets: translated UI (right-to-left Arabic), local labor law, local currency, local payroll exports.
- Simple, mobile-first, and cheap for small businesses with 5–30 staff.

**Business model**
- Free: one person, local only (this app).
- Team (about $2–4 per user per month): sync, manager dashboard, approvals, exports.
- Business (about $5–8 per user per month): overtime rules, check-in, kiosk mode, payroll integrations.
- 14-day free trial; discount for yearly billing.

**Path**
1. Polish the personal app, add JSON backup/restore, get 10–20 real users.
2. Talk to 5–10 small business owners in the niche before building a backend.
3. MVP SaaS: accounts, sync, team dashboard, audit log, monthly approval, payroll export. Use a managed backend (e.g. Supabase or Firebase).
4. Grow with what paying customers ask for.

**Legal:** storing employee data on a server brings privacy laws into play (KVKK in Turkey, GDPR in Europe). A privacy policy and secure storage are needed from day one.
