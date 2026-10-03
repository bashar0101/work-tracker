# Work Hours Tracker — Spec & Build Plan

- **Part 1 — Spec** is the single source of truth for how the app behaves.
- **Part 2 — Phases** is the build order. Do one phase at a time.
- Rules for code, tests, and workflow are in `CLAUDE.md`.

## Progress
- [x] Phase 1 — Project setup and time helpers
- [ ] Phase 2 — Storage layer
- [ ] Phase 3 — Start, end, and live timer
- [ ] Phase 4 — Statistics
- [ ] Phase 5 — Session history
- [ ] Phase 6 — Month picker and CSV export
- [ ] Phase 7 — PDF export
- [ ] Phase 8 — Polish and final check

---

# Part 1 — Spec

## 1. Scope

**Build:** start and end work sessions, a live timer, daily/weekly/monthly statistics, session history, monthly CSV and PDF export, localStorage persistence, a mobile-friendly UI.

**Don't build unless I ask:** backend, API, database, auth, cloud sync or backup, multiple users or jobs, wage/overtime/salary calculations, editing or deleting sessions, PWA, dark mode.

## 2. Data model

```ts
// src/lib/types.ts
export interface WorkSession {
  id: string;
  startTime: string;       // ISO timestamp from toISOString()
  endTime: string;         // ISO timestamp
  durationMinutes: number; // Math.round((end - start) / 60_000)
}

export interface ActiveSession {
  startTime: string;       // ISO timestamp
}
```

Two **separate** localStorage keys:

| Key | Value | If missing |
|---|---|---|
| `work_sessions` | JSON array of `WorkSession` | no sessions yet (`[]`) |
| `active_work_session` | JSON `ActiveSession` | not working |

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
- [ ] `src/lib/storage.ts`: `getSessions`, `saveSessions`, `getActiveSession`, `saveActiveSession`, `clearActiveSession`, plus readers that return the raw stored strings (the hook needs them in Phase 3).
- [ ] Parsing and validation are pure functions (for example `parseSessions(raw: string | null)`), so they can be tested without a browser.
- [ ] Writes catch errors and return success or failure. They never throw into the UI.
- [ ] After every write, dispatch a custom `window` event, so the same tab can update. (The `storage` event only fires in other tabs.)

Tests must include: `null`, empty string, invalid JSON, JSON that is not an array, an array with some invalid items (the valid ones are kept), and a valid round trip.

**Done when:** the four commands pass.

## Phase 3 — Start, end, and live timer
- [ ] `src/lib/sessions.ts` with tests: `createSession(active, now)` and the ID helper from §2. Cover duration rounding and a session that crosses midnight.
- [ ] `src/hooks/useWorkTracker.ts`:
  - Reads storage with `useSyncExternalStore`. The server snapshot means "not loaded yet", and it must be different from "storage is empty".
  - `getSnapshot` returns the raw stored strings (stable values). Parse them with `useMemo`. If `getSnapshot` returns a new object on every call, React re-renders forever.
  - Subscribes to the `storage` event (other tabs) and to the custom event from Phase 2 (same tab).
  - Returns `status` (`loading` | `working` | `idle`), `activeSession`, `sessions`, `startWork`, `endWork`, and `error`.
- [ ] Components: `Dashboard` (`"use client"`), `StatusCard`, `Timer`, `WorkControls`.

**Done when:** the four commands pass.

**Manual checks:**
1. Start Work → the timer counts up from `00:00:00`, and "Started at" shows the right time.
2. Refresh → still Working, and the timer continues from the right value.
3. Refresh several times → never a flash of "Not Working" or a Start button.
4. End Work → Not Working. In DevTools → Application → Local Storage, the session is in `work_sessions` and `active_work_session` is gone.
5. Two tabs: start in tab A → tab B switches to Working. Nothing in tab B resets tab A's timer.
6. Leave the tab in the background for 2+ minutes → the timer is correct when you come back.

## Phase 4 — Statistics
- [ ] `src/lib/statistics.ts` with tests, following §5. Functions take `sessions` and `now`. The monthly function takes the month to report on, so the PDF can reuse it.
- [ ] `SummaryCard` and the three cards: Today, This Week, This Month.
- [ ] Update the cards' `now` every minute, so "Today" changes at midnight while the page stays open.

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
- [ ] `SessionHistory` following §4 and §6: newest first, `(+1)` for sessions that end on a later day, a table from `md`, stacked rows on small screens, and the empty state.

**Done when:** the four commands pass.
**Manual checks:** load 5+ sessions with a console snippet (one of them across midnight) → order, formats, and `(+1)` are correct. At 375px width there is no horizontal scroll.

## Phase 6 — Month picker and CSV export
- [ ] Month list helper in `src/lib/statistics.ts` with tests: only months with sessions, newest first, default rule from §7.
- [ ] `src/lib/exportCsv.ts`: a pure `buildCsv(sessions)` with tests (exact header, oldest first, a night-shift row, §4 formats), plus the download helper.
- [ ] `ExportControls`: month picker, Export CSV, Export PDF (disabled until Phase 7), and the empty state.

**Done when:** the four commands pass.
**Manual checks:** the file is named `work-sessions-YYYY-MM.csv` for the chosen month; the columns are correct in Google Sheets or Excel; the download works on a phone. (If Excel puts everything in one column, your system's list separator is `;`. Import with Data → From Text/CSV; don't change the file format.)

## Phase 7 — PDF export
- [ ] `npm install jspdf jspdf-autotable`
- [ ] `src/lib/exportPdf.ts`: load `jspdf` and `jspdf-autotable` with dynamic `import()` inside the export function. This keeps them off the server and out of the first page load. Use the function form: `autoTable(doc, { ... })`.
- [ ] Content and file name from §7. Reuse the statistics functions and `time.ts` formatters; no new calculations.
- [ ] Catch errors and show them inline.

**Done when:** the four commands pass.
**Manual checks:** the PDF opens; its numbers match the dashboard for the same month; a month with 40+ sessions continues cleanly onto page 2; the download works on a phone.

## Phase 8 — Polish and final check
- [ ] Review every empty state and error message (§3, §6).
- [ ] Check the layout at 375px, 768px, and 1280px.
- [ ] Remove unused code, files, and dependencies. No errors or warnings in the browser console.
- [ ] Go through the Definition of Done.

**Manual check on a real phone:** run `npm run build`, then `npm start`. On the same Wi-Fi, open `http://<your-PC-IP>:3000`. Repeat the Phase 3 checks, then export one CSV and one PDF.

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

## Ideas (not in scope)
Ideas that come up during the build go here, not into the code.
- Delete or edit a session (fix a forgotten End Work or an accidental start).
- Backup and restore all data as a JSON file.
