# Work Hours Tracker

A single-page web app for tracking your work sessions.

- Start and end a work session, with a live timer.
- See daily, weekly, and monthly statistics.
- See your session history.
- Export a month as CSV or PDF.

## Your data stays in your browser

There is no backend, no account, and no server storage. All data lives in
your browser's `localStorage` (keys `work_sessions` and
`active_work_session`). Clearing your browser's site data deletes it.
Exports are created in the browser too.

## Commands

```bash
npm install     # install dependencies
npm run dev     # dev server on http://localhost:3000
npm test        # unit tests (vitest run)
npm run lint    # ESLint
npx tsc --noEmit  # type check
npm run build   # production build
npm start       # run the production build
```

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS v4, jsPDF with
jspdf-autotable for the PDF, and Vitest for tests.

The spec and build plan are in `PROJECT_PLAN.md`. Rules for working on the
code are in `CLAUDE.md`.
