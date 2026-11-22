/** Approved aggregate website usage (public/data/platform_usage.json): site-wide totals and daily visits and page views, nothing else.
 *  Mirrors scripts/usage-schema.mjs; a file that does not pass is ignored and the page shows the "not yet available" state. */
export type Usage = {
  source: string;
  periodStart: string;
  periodEnd: string;
  updated: string;
  visits: number;
  pageViews: number;
  daily: { date: string; visits: number; pageViews: number }[];
};

const KEYS = ["schemaVersion", "source", "periodStart", "periodEnd", "updated", "visits", "pageViews", "daily"];
const DAILY = ["date", "visits", "pageViews"];
const MAX_DAYS = 400;
const DAY = 864e5;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
const dayIndex = (iso: string) => Date.parse(iso + "T00:00:00Z") / DAY;

export function parseUsage(input: unknown): Usage | null {
  const u = input as Record<string, any> | null;
  if (!u || typeof u !== "object" || Array.isArray(u)) return null;
  if (Object.keys(u).some((k) => !KEYS.includes(k)) || u.schemaVersion !== 1) return null;
  if (typeof u.source !== "string" || !u.source.trim() || u.source.length > 80) return null;
  if (![u.periodStart, u.periodEnd, u.updated].every(isDate) || u.periodStart > u.periodEnd || u.updated < u.periodEnd) return null;
  if (dayIndex(u.periodEnd) - dayIndex(u.periodStart) + 1 > MAX_DAYS) return null;
  if (!isCount(u.visits) || !isCount(u.pageViews) || u.visits > u.pageViews) return null;
  if (!Array.isArray(u.daily) || u.daily.length > MAX_DAYS) return null;
  let pv = 0, vs = 0, last = "";
  for (const d of u.daily) {
    if (!d || typeof d !== "object" || Object.keys(d).some((k) => !DAILY.includes(k))) return null;
    if (!isDate(d.date) || d.date <= last || d.date < u.periodStart || d.date > u.periodEnd) return null;
    if (!isCount(d.pageViews) || !isCount(d.visits) || d.visits > d.pageViews) return null;
    last = d.date;
    pv += d.pageViews;
    vs += d.visits;
  }
  if (pv !== u.pageViews || vs !== u.visits || /SL-[0-9a-f]{12}/i.test(JSON.stringify(u))) return null;
  return { source: u.source, periodStart: u.periodStart, periodEnd: u.periodEnd, updated: u.updated, visits: u.visits, pageViews: u.pageViews, daily: u.daily };
}

export type UsageSummary = {
  /** Calendar days in the reporting period, start and end included. */
  days: number;
  /** Total page views / total visits; null when there are no visits (never shown as zero). */
  pageViewsPerVisit: number | null;
  /** Total visits / calendar days in the reporting period. */
  avgDailyVisits: number;
  /** One entry per calendar day; days without a reported value are null (a gap, never zero). */
  series: { date: string; visits: number | null; pageViews: number | null }[];
};

/** Derived statistics, calculated only from the exported values. */
export function summarizeUsage(u: Usage): UsageSummary {
  const start = dayIndex(u.periodStart);
  const days = dayIndex(u.periodEnd) - start + 1;
  const byDate = new Map(u.daily.map((d) => [d.date, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date((start + i) * DAY).toISOString().slice(0, 10);
    const d = byDate.get(date);
    return { date, visits: d ? d.visits : null, pageViews: d ? d.pageViews : null };
  });
  return { days, pageViewsPerVisit: u.visits > 0 ? u.pageViews / u.visits : null, avgDailyVisits: u.visits / days, series };
}

/** Loads the approved aggregate file. Any failure (not exported yet, offline, invalid) is simply "unavailable". */
export async function loadUsage(base = import.meta.env.BASE_URL): Promise<Usage | null> {
  try {
    const res = await fetch(base + "data/platform_usage.json", { cache: "no-cache" });
    return res.ok ? parseUsage(await res.json()) : null;
  } catch {
    return null;
  }
}
