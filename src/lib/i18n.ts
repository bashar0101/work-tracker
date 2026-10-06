// UI languages (PROJECT_PLAN.md §13): English and Arabic. Plain objects,
// no library. `ar` must have exactly the keys of `en`; TypeScript checks it.
// Digits are always 0-9. The CSV and PDF still use English (§4).

export type Locale = "en" | "ar";

export const LOCALES: readonly Locale[] = ["en", "ar"];

/** The saved locale, or `null` for anything else (missing, old, typo). */
export function parseLocale(raw: string | null): Locale | null {
  return raw === "en" || raw === "ar" ? raw : null;
}

/**
 * The first browser language that is Arabic or English decides; anything
 * else (or nothing) gives English. `["ar-SA", "en"]` → `ar`.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const code = language.trim().toLowerCase();
    if (code === "ar" || code.startsWith("ar-")) return "ar";
    if (code === "en" || code.startsWith("en-")) return "en";
  }
  return "en";
}

/** Text direction for a locale. */
export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

interface ArabicForms {
  /** n = 1, e.g. `جلسة واحدة`. */
  one: string;
  /** n = 2, e.g. `جلستان`. */
  two: string;
  /** 3–10 after the number, e.g. `جلسات`. */
  few: string;
  /** 0 and 11+ after the number, e.g. `جلسة`. */
  many: string;
}

/** An Arabic count with the right plural form. */
export function arabicCount(n: number, forms: ArabicForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const lastTwo = n % 100;
  if (lastTwo >= 3 && lastTwo <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

const AR_SESSIONS: ArabicForms = {
  one: "جلسة واحدة",
  two: "جلستان",
  few: "جلسات",
  many: "جلسة",
};

/** Messages for the session form errors (codes from `sessionEdit.ts`). */
type SessionErrors = Record<
  "invalid" | "same-time" | "future" | "overlap" | "overlaps-active" | "not-found",
  string
>;

/** Messages for the backup errors (codes from `backup.ts` and the hook). */
type BackupErrors = Record<
  "too-large" | "not-backup" | "newer-version" | "restore-working" | "restore-failed",
  string
>;

const en = {
  appTitle: "Work Hours Tracker",
  appSubtitle: "Track your work time",
  language: "Language",
  loading: "Loading…",
  saveFailed: "Could not save. Your browser storage may be full or blocked.",
  sessions: (n: number) => (n === 1 ? "1 session" : `${n} sessions`),
  status: {
    label: "Work status",
    working: "WORKING",
    notWorking: "NOT WORKING",
    startedAt: "Started at",
    earnedSoFar: "Earned so far",
  },
  controls: { start: "Start Work", end: "End Work" },
  cards: {
    today: "Today",
    thisWeek: "This Week",
    thisMonth: "This Month",
    total: "Total",
    sessions: "Sessions",
    earnings: "Earnings",
    workingDays: "Working days",
    dailyAverage: "Daily average",
    longestDay: "Longest day",
  },
  progress: {
    title: "Progress",
    ofTarget: (label: string, percent: string) => `${label}: ${percent} of target`,
    targetReached: "Target reached",
    left: (duration: string) => `${duration} left`,
    paceTitle: "Pace this month",
    expected: "Expected by now",
    neededPerDay: "Needed per day",
    projection: "Month-end projection",
    daysOffLeft: "Days off left",
    daysOffValue: (left: number, allowed: number) => `${left} of ${allowed}`,
    missedDays: "Missed days",
    onTrack: "On track",
    aheadBy: (duration: string) => `Ahead by ${duration}`,
    behindBy: (duration: string) => `Behind by ${duration}`,
  },
  targets: {
    title: "Targets",
    hoursPerDay: "Hours per day",
    daysOffPerMonth: "Days off per month",
    save: "Save",
    hoursError: "Enter hours per day from 0.01 to 24, with up to 2 decimals.",
    daysOffError: "Enter days off per month as a whole number from 0 to 10.",
    badge: (daily: string, daysOff: number) =>
      `${daily} / day · ${daysOff} off / month`,
    hint: "Days with no work count as days off automatically, up to this number each month.",
  },
  pay: {
    title: "Pay",
    hourlyRate: "Hourly rate",
    currency: "Currency",
    save: "Save",
    rateError: "Enter a rate between 0 and 100000 with up to 2 decimals.",
    perHour: (money: string) => `${money} / hour`,
    setRateHint: "Set your hourly rate to see earnings.",
    rateNote: "New sessions use this rate. Past sessions keep theirs.",
  },
  export: {
    label: "Export",
    month: "Month:",
    csv: "Export CSV",
    pdf: "Export PDF",
    creatingPdf: "Creating PDF…",
    noSessions: "No sessions to export yet.",
    pdfError: "Could not create the PDF. Please try again.",
  },
  backup: {
    title: "Backup",
    intro:
      "Your data lives only in this browser. Download a backup to keep it safe or move it to another device.",
    download: "Download backup",
    restore: "Restore from file",
    workingHint:
      "The running session is saved in the backup after you end it. End the running session before restoring.",
    confirmTitle: "Replace your data?",
    preview: (count: string, range: string | null, current: string) =>
      `This backup has ${count}${range ? ` (${range})` : ""}. Restoring replaces all current data (${current}, pay settings, and targets).`,
    skipped: (n: number) =>
      `${n} invalid ${n === 1 ? "session" : "sessions"} will be skipped.`,
    cancel: "Cancel",
    confirm: "Replace my data",
    restored: (count: string) => `Restored ${count}.`,
    readError: "Could not read this file.",
    errors: {
      "too-large": "This file is too large. A backup is at most 5 MB.",
      "not-backup": "This is not a Work Hours Tracker backup.",
      "newer-version": "This backup was made by a newer version of the app.",
      "restore-working": "End the running session before restoring.",
      "restore-failed": "Could not restore. Your data was not changed.",
    } satisfies BackupErrors,
  },
  history: {
    title: "Session History",
    loading: "Loading sessions…",
    empty: "No sessions yet. Press Start Work to begin.",
    add: "Add session",
    date: "Date",
    start: "Start",
    end: "End",
    duration: "Duration",
    earnings: "Earnings",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    editLabel: (session: string) => `Edit session ${session}`,
    deleteLabel: (session: string) => `Delete session ${session}`,
    deleteGroupLabel: (session: string) => `Delete session ${session}?`,
    confirmDelete: "Delete this session?",
    cancel: "Cancel",
    earningsPrefix: "Earnings: ",
  },
  form: {
    addTitle: "Add session",
    editTitle: "Edit session",
    date: "Date",
    start: "Start",
    end: "End",
    duration: "Duration:",
    endsNextDay: "Ends next day (+1)",
    cancel: "Cancel",
    save: "Save",
    errors: {
      invalid: "Enter a valid date, start time, and end time.",
      "same-time": "End time must be different from start time.",
      future: "The session can't end in the future.",
      overlap: "This time overlaps another session.",
      "overlaps-active":
        "This time overlaps the running session. It must end before the running session started.",
      "not-found":
        "This session no longer exists. It may have been deleted in another tab.",
    } satisfies SessionErrors,
  },
};

export type Messages = typeof en;

const ar: Messages = {
  appTitle: "متتبع ساعات العمل",
  appSubtitle: "تتبّع وقت عملك",
  language: "اللغة",
  loading: "جارٍ التحميل…",
  saveFailed: "تعذّر الحفظ. قد تكون مساحة تخزين المتصفح ممتلئة أو محظورة.",
  sessions: (n) => arabicCount(n, AR_SESSIONS),
  status: {
    label: "حالة العمل",
    working: "قيد العمل",
    notWorking: "خارج العمل",
    startedAt: "بدأ الساعة",
    earnedSoFar: "المكسب حتى الآن",
  },
  controls: { start: "ابدأ العمل", end: "إنهاء العمل" },
  cards: {
    today: "اليوم",
    thisWeek: "هذا الأسبوع",
    thisMonth: "هذا الشهر",
    total: "الإجمالي",
    sessions: "الجلسات",
    earnings: "الأرباح",
    workingDays: "أيام العمل",
    dailyAverage: "المعدل اليومي",
    longestDay: "أطول يوم",
  },
  progress: {
    title: "التقدّم",
    ofTarget: (label, percent) => `${label}: ${percent} من الهدف`,
    targetReached: "تم بلوغ الهدف",
    left: (duration) => `متبقٍ ${duration}`,
    paceTitle: "وتيرة هذا الشهر",
    expected: "المتوقع حتى الآن",
    neededPerDay: "المطلوب يوميًا",
    projection: "المتوقع في نهاية الشهر",
    daysOffLeft: "أيام العطلة المتبقية",
    daysOffValue: (left, allowed) => `${left} من ${allowed}`,
    missedDays: "أيام فائتة",
    onTrack: "على المسار الصحيح",
    aheadBy: (duration) => `متقدّم بـ ${duration}`,
    behindBy: (duration) => `متأخر بـ ${duration}`,
  },
  targets: {
    title: "الأهداف",
    hoursPerDay: "ساعات العمل يوميًا",
    daysOffPerMonth: "أيام العطلة شهريًا",
    save: "حفظ",
    hoursError: "أدخل ساعات العمل يوميًا من 0.01 إلى 24، بحد أقصى منزلتين عشريتين.",
    daysOffError: "أدخل أيام العطلة الشهرية كعدد صحيح من 0 إلى 10.",
    badge: (daily, daysOff) => `${daily} / يوم · ${daysOff} عطلة / شهر`,
    hint: "الأيام التي بلا عمل تُحسب أيام عطلة تلقائيًا، حتى هذا العدد كل شهر.",
  },
  pay: {
    title: "الأجر",
    hourlyRate: "الأجر بالساعة",
    currency: "العملة",
    save: "حفظ",
    rateError: "أدخل أجرًا بين 0 و100000 بحد أقصى منزلتين عشريتين.",
    perHour: (money) => `${money} / ساعة`,
    setRateHint: "حدّد أجرك بالساعة لرؤية الأرباح.",
    rateNote: "الجلسات الجديدة تستخدم هذا الأجر. الجلسات السابقة تحتفظ بأجرها.",
  },
  export: {
    label: "التصدير",
    month: "الشهر:",
    csv: "تصدير CSV",
    pdf: "تصدير PDF",
    creatingPdf: "جارٍ إنشاء PDF…",
    noSessions: "لا توجد جلسات للتصدير بعد.",
    pdfError: "تعذّر إنشاء ملف PDF. حاول مرة أخرى.",
  },
  backup: {
    title: "النسخ الاحتياطي",
    intro:
      "بياناتك محفوظة في هذا المتصفح فقط. نزّل نسخة احتياطية لحمايتها أو لنقلها إلى جهاز آخر.",
    download: "تنزيل نسخة احتياطية",
    restore: "استعادة من ملف",
    workingHint:
      "تُحفظ الجلسة الجارية في النسخة الاحتياطية بعد إنهائها. أنهِ الجلسة الجارية قبل الاستعادة.",
    confirmTitle: "استبدال بياناتك؟",
    preview: (count, range, current) =>
      `تحتوي هذه النسخة على ${count}${range ? ` (${range})` : ""}. الاستعادة تستبدل كل البيانات الحالية (${current}، إعدادات الأجر، والأهداف).`,
    skipped: (n) => `جلسات غير صالحة سيتم تخطيها: ${n}`,
    cancel: "إلغاء",
    confirm: "استبدال بياناتي",
    restored: (count) => `تمت استعادة ${count}.`,
    readError: "تعذّرت قراءة هذا الملف.",
    errors: {
      "too-large": "هذا الملف كبير جدًا. الحد الأقصى للنسخة الاحتياطية 5 ميغابايت.",
      "not-backup": "هذا الملف ليس نسخة احتياطية من متتبع ساعات العمل.",
      "newer-version": "أُنشئت هذه النسخة بإصدار أحدث من التطبيق.",
      "restore-working": "أنهِ الجلسة الجارية قبل الاستعادة.",
      "restore-failed": "تعذّرت الاستعادة. لم تتغير بياناتك.",
    },
  },
  history: {
    title: "سجل الجلسات",
    loading: "جارٍ تحميل الجلسات…",
    empty: "لا توجد جلسات بعد. اضغط «ابدأ العمل» للبدء.",
    add: "إضافة جلسة",
    date: "التاريخ",
    start: "البداية",
    end: "النهاية",
    duration: "المدة",
    earnings: "الأرباح",
    actions: "إجراءات",
    edit: "تعديل",
    delete: "حذف",
    editLabel: (session) => `تعديل جلسة ${session}`,
    deleteLabel: (session) => `حذف جلسة ${session}`,
    deleteGroupLabel: (session) => `حذف جلسة ${session}؟`,
    confirmDelete: "حذف هذه الجلسة؟",
    cancel: "إلغاء",
    earningsPrefix: "الأرباح: ",
  },
  form: {
    addTitle: "إضافة جلسة",
    editTitle: "تعديل الجلسة",
    date: "التاريخ",
    start: "البداية",
    end: "النهاية",
    duration: "المدة:",
    endsNextDay: "تنتهي في اليوم التالي",
    cancel: "إلغاء",
    save: "حفظ",
    errors: {
      invalid: "أدخل تاريخًا ووقت بداية ووقت نهاية صحيحة.",
      "same-time": "يجب أن يختلف وقت النهاية عن وقت البداية.",
      future: "لا يمكن أن تنتهي الجلسة في المستقبل.",
      overlap: "هذا الوقت يتداخل مع جلسة أخرى.",
      "overlaps-active":
        "هذا الوقت يتداخل مع الجلسة الجارية. يجب أن ينتهي قبل بدء الجلسة الجارية.",
      "not-found": "هذه الجلسة لم تعد موجودة. ربما حُذفت في تبويب آخر.",
    },
  },
};

export const MESSAGES: Record<Locale, Messages> = { en, ar };
