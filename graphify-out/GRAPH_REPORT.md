# Graph Report - Work Hours Tracker  (2026-10-07)

## Corpus Check
- Corpus is ~35,936 words - fits in a single context window. You may not need a graph.

## Summary
- 488 nodes · 1354 edges · 20 communities (18 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.85)
- Token cost: 90,293 input · 0 output

## Community Hubs (Navigation)
- Tracker Hook and Storage
- UI Shell, I18n, Icons
- Backup and CSV Export
- Dashboard and Summaries
- PDF Export and History
- Spec Rules and Features
- Targets and Progress
- Earnings and Money
- TypeScript Config
- Arabic/English Messages
- Package Manifest
- Next App Layout
- Dev Dependencies
- Runtime Dependencies
- npm Scripts
- ESLint Config
- PDF Export Trigger
- Layering Principles
- PostCSS Config
- UI Layout Spec

## God Nodes (most connected - your core abstractions)
1. `Dashboard()` - 38 edges
2. `useWorkTracker()` - 36 edges
3. `formatDuration()` - 28 edges
4. `useI18n()` - 25 edges
5. `WorkSession` - 24 edges
6. `toDateKey()` - 18 edges
7. `buildPdfReport()` - 16 edges
8. `compilerOptions` - 16 edges
9. `formatMoney()` - 15 edges
10. `formatTime()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Your Data Stays in Your Browser` --semantically_similar_to--> `Hard Rule: No Backend (client-side only)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Only storage.ts May Use localStorage` --shares_data_with--> `localStorage Keys (work_sessions, active_work_session, pay_settings, work_targets, ui_language)`  [INFERRED]
  CLAUDE.md → PROJECT_PLAN.md
- `No any; JSON.parse as unknown with Type Guards` --rationale_for--> `localStorage Keys (work_sessions, active_work_session, pay_settings, work_targets, ui_language)`  [INFERRED]
  CLAUDE.md → PROJECT_PLAN.md
- `Local Date Keys Rule (never toISOString().slice)` --rationale_for--> `Statistics Rules (§5: sessions count for start day, Mon-Sun week)`  [INFERRED]
  CLAUDE.md → PROJECT_PLAN.md
- `Vitest with TZ=Europe/Istanbul` --conceptually_related_to--> `Local Date Keys Rule (never toISOString().slice)`  [INFERRED]
  PROJECT_PLAN.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Locale-independent text to keep jsPDF safe** — claude_no_tolocalestring_rule, project_plan_formats, project_plan_money_format, project_plan_jspdf, project_plan_exports [INFERRED 0.85]
- **Client storage sync architecture** — claude_use_work_tracker_hook, claude_storage_only_localstorage, project_plan_use_sync_external_store, project_plan_custom_storage_event, project_plan_localstorage_keys [INFERRED 0.85]
- **Targets, days off, and pace calculation** — project_plan_hour_targets, project_plan_automatic_days_off, project_plan_pace_analysis, project_plan_statistics [EXTRACTED 1.00]

## Communities (20 total, 2 thin omitted)

### Community 0 - "Tracker Hook and Storage"
Cohesion: 0.09
Nodes (60): getBrowserLanguages(), getLoadedClient(), getLoadedServer(), getNoLanguages(), getRawServer(), noopSubscribe(), saveEdit(), useWorkTracker() (+52 more)

### Community 1 - "UI Shell, I18n, Icons"
Cohesion: 0.07
Nodes (51): react, BackupCardProps, BackupError, ExportControls(), ExportControlsProps, I18nContext, I18nValue, Ltr() (+43 more)

### Community 2 - "Backup and CSV Export"
Cohesion: 0.06
Nodes (44): RFC-4180, ref_node_url, vitest, BackupCard(), handleFile(), handleDownloadBackup(), handleExportCsv(), BACKUP_APP (+36 more)

### Community 3 - "Dashboard and Summaries"
Cohesion: 0.09
Nodes (41): Dashboard(), formatAverage(), getMinute(), getServerMinute(), subscribeToMinute(), I18nProvider(), CalendarIcon(), ChartIcon() (+33 more)

### Community 4 - "PDF Export and History"
Cohesion: 0.10
Nodes (39): dateText(), formatLongestDay(), SessionHistory(), actionsFor(), confirmDelete(), openAdd(), openEdit(), toRow() (+31 more)

### Community 5 - "Spec Rules and Features"
Cohesion: 0.06
Nodes (41): generate-agent-files.js (next dev re-adds AGENTS.md block), Next.js Breaking Changes Notice (read node_modules/next/dist/docs), Dependency Allowlist (jspdf, jspdf-autotable, vitest), MESSAGES via useI18n (error codes, not sentences), Local Date Keys Rule (never toISOString().slice), No any; JSON.parse as unknown with Type Guards, Hard Rule: No Backend (client-side only), No toLocaleString Formatting Rule (+33 more)

### Community 6 - "Targets and Progress"
Cohesion: 0.11
Nodes (33): GaugeIcon(), TargetIcon(), BAR_FILL, PACE_BADGE, ProgressCard(), ProgressCardProps, ProgressRow(), TargetsCard() (+25 more)

### Community 7 - "Earnings and Money"
Cohesion: 0.24
Nodes (19): PayCard(), handleSubmit(), CURRENCIES, DEFAULT_CURRENCY, effectiveRate(), formatCsvMoney(), formatCsvRate(), formatMoney() (+11 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 9 - "Arabic/English Messages"
Cohesion: 0.18
Nodes (13): ar, AR_SESSIONS, arabicCount(), ArabicForms, BackupErrors, detectLocale(), directionOf(), en (+5 more)

### Community 10 - "Package Manifest"
Cohesion: 0.18
Nodes (10): name, private, version, react-dom, tailwindcss, @tailwindcss/postcss, @types/node, @types/react (+2 more)

### Community 11 - "Next App Layout"
Cohesion: 0.20
Nodes (7): nextConfig, next, src_app_globals, geistMono, geistSans, metadata, notoArabic

### Community 12 - "Dev Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+2 more)

### Community 13 - "Runtime Dependencies"
Cohesion: 0.33
Nodes (6): dependencies, jspdf, jspdf-autotable, next, react, react-dom

### Community 14 - "npm Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 15 - "ESLint Config"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 16 - "PDF Export Trigger"
Cohesion: 0.50
Nodes (4): jspdf, jspdf-autotable, handleExportPdf(), exportPdf()

### Community 17 - "Layering Principles"
Cohesion: 0.67
Nodes (3): Components Are UI Only (props in, callbacks out), src/lib Pure Logic Layer, now: Date Passed as Parameter

## Knowledge Gaps
- **108 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 145 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `UI Shell, I18n, Icons` to `Tracker Hook and Storage`, `Dashboard and Summaries`, `Targets and Progress`, `Earnings and Money`, `Package Manifest`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `vitest` connect `Backup and CSV Export` to `Tracker Hook and Storage`, `Dashboard and Summaries`, `PDF Export and History`, `Targets and Progress`, `Earnings and Money`, `Arabic/English Messages`, `Package Manifest`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `WorkSession` connect `Backup and CSV Export` to `Tracker Hook and Storage`, `UI Shell, I18n, Icons`, `Dashboard and Summaries`, `PDF Export and History`, `Targets and Progress`, `Earnings and Money`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Dashboard()` (e.g. with `getMinute()` and `getServerMinute()`) actually correct?**
  _`Dashboard()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `useWorkTracker()` (e.g. with `getBrowserLanguages()` and `getLoadedClient()`) actually correct?**
  _`useWorkTracker()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tracker Hook and Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.08864767073722297 - nodes in this community are weakly interconnected._