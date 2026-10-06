@AGENTS.md

# Work Hours Tracker

A single-page Next.js app for tracking work sessions: start and end a session, a live timer, daily/weekly/monthly statistics, hourly-rate earnings, hour targets with progress and pace, session history, and CSV/PDF export. Fully client-side: all data lives in the browser's localStorage.

`PROJECT_PLAN.md` holds the spec and the build plan. Read it before any feature work. If something is unclear, or conflicts with this file, ask me. Don't guess.

## Hard rules
- IMPORTANT: No backend. No API routes, route handlers, server actions, database, auth, or network requests. User data never leaves the browser.
- Dependencies: only what create-next-app installed, plus `jspdf` and `jspdf-autotable` (runtime) and `vitest` (dev). Ask before adding anything else, including date, UI, icon, or state libraries.
- Build only what PROJECT_PLAN.md describes. Put new ideas in its "Ideas" section, not in the code.

## Commands
- `npm run dev` — dev server on http://localhost:3000
- `npm test` — unit tests (`vitest run`)
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type check
- `npm run build` — production build

## Stack
Next.js (App Router, `src/` directory, `@/*` import alias), React, TypeScript, Tailwind CSS v4. Tailwind v4 is configured in `globals.css`. There is no `tailwind.config.js`; don't create one.

## Architecture
- `src/lib/` — all logic, in plain TypeScript with no React: `types.ts`, `time.ts`, `storage.ts`, `sessions.ts`, `sessionEdit.ts` (edit, delete, and add sessions, §11), `statistics.ts`, `earnings.ts` (hourly rate and money, §9), `progress.ts` (hour targets, progress, and pace, §10), `exportCsv.ts`, `exportPdf.ts`, `backup.ts` (backup and restore, §12), `download.ts` (shared file download), `i18n.ts` (English and Arabic messages, §13). Tests sit next to the code as `*.test.ts`.
- `src/hooks/useWorkTracker.ts` — the only bridge between React and storage.
- `src/components/` — UI only. Data comes in through props; actions go out through callbacks. No business logic: call functions from `src/lib/`.
- `src/app/page.tsx` stays a Server Component that renders the client `<Dashboard />`.
- Only `src/lib/storage.ts` may use `localStorage`.

## Time and date rules (most bugs in this app come from here)
- Store timestamps as ISO strings (`toISOString()`). Calculate durations from timestamps, never from displayed text.
- Days, weeks, and months use the device's local time. Build `YYYY-MM-DD` keys from `getFullYear()`, `getMonth()`, and `getDate()`. Never use `toISOString().slice(0, 10)`: that is the UTC date, and it puts sessions near midnight on the wrong day.
- Functions in `src/lib/` that need the current time take `now: Date` as a parameter. They don't read the clock themselves.
- Format every date, time, and duration with the helpers in `src/lib/time.ts` (formats: PROJECT_PLAN.md §4). Never use `toLocaleString()`, `toLocaleDateString()`, or `toLocaleTimeString()`: their output changes with the browser language, and Turkish or Arabic text breaks jsPDF's built-in font.

## Language rules (English and Arabic UI, PROJECT_PLAN.md §13)
- Every visible text, label, and screen-reader label comes from `MESSAGES` in `src/lib/i18n.ts` through `useI18n()`. Add a new text to both `en` and `ar`; TypeScript fails if one is missing.
- `src/lib` returns error codes, not sentences. The UI turns codes into text.
- UI formatters get the `locale`: `formatDate(date, locale)`, `formatDuration(minutes, locale)`. CSV and PDF call them without it (English).
- Digits are always 0–9, also in Arabic.
- Use start/end CSS (`ms-auto`, `text-end`, `ps-4`, `end-4`), never left/right, for anything that should mirror in Arabic. Wrap times and `HH:mm (+1)` in `<Ltr>`.

## React rules
- `localStorage` exists only in the browser. Never touch it on the server or at module level. `useWorkTracker` reads it with `useSyncExternalStore` (details: PROJECT_PLAN.md, Phase 3).
- Until storage has loaded, show a loading state, never a clickable Start button.
- Keep render pure: no `Date.now()` or `new Date()` during render. Keep `now` in state and update it from an interval.
- The 1-second tick lives only inside `<Timer>`, so the rest of the page doesn't re-render every second.

## Code rules
- No `any`. Treat `JSON.parse` results as `unknown` and check them with type guards.
- Every view handles empty data: no sessions, no active session, zero working days. Never show `NaN`.

## Workflow
1. Work on one phase of PROJECT_PLAN.md at a time. Start by listing the files you will create or change.
2. Add or update unit tests for every function you add or change in `src/lib/`.
3. A phase is done only when `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass. Show me the output.
4. Manual checks: if you can control a browser, run the phase's checks yourself and show screenshots. Otherwise, give me the checks as steps. When a check needs data, give me a DevTools console snippet that fills localStorage. Don't add test data to the app.
5. Stop and wait for my OK before the next phase. After my OK, tick the phase's boxes in PROJECT_PLAN.md (including its line under Progress) and commit with the message `Phase N: <title>`.
6. If a decision in the spec changes, update the spec and add a line to its Decisions log.

## Communication
Explain things in simple English with short sentences.
