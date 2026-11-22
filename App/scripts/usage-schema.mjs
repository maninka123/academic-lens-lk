// Strict schema for the ONE analytics file the website may publish: public/data/platform_usage.json.
// It holds site-wide totals and daily visits and page views, nothing else. Page paths, visitor countries,
// referral sources, identifiers and tokens are rejected, so a mistake cannot publish them.
// Used by scripts/usage-export.mjs (before writing), scripts/public-assets.mjs (every check, CI included)
// and mirrored in src/analytics/usage.ts (the page ignores a file that does not pass).

export const USAGE_FILE = "platform_usage.json";
export const USAGE_KEYS = ["schemaVersion", "source", "periodStart", "periodEnd", "updated", "visits", "pageViews", "daily"];
export const DAILY_KEYS = ["date", "visits", "pageViews"];
export const MAX_DAYS = 400;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isDate = (v) => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));

/** Problems with a candidate public usage object (empty list = valid). */
export function validateUsage(u) {
  const p = [];
  if (!u || typeof u !== "object" || Array.isArray(u)) return ["not an object"];
  for (const k of Object.keys(u)) if (!USAGE_KEYS.includes(k)) p.push(`key "${k}" is not allowed in public usage data`);
  if (u.schemaVersion !== 1) p.push("schemaVersion must be 1");
  if (typeof u.source !== "string" || !u.source.trim() || u.source.length > 80) p.push("source must be a short text");
  for (const k of ["periodStart", "periodEnd", "updated"]) if (!isDate(u[k])) p.push(`${k} must be a date (YYYY-MM-DD)`);
  for (const k of ["visits", "pageViews"]) if (!isCount(u[k])) p.push(`${k} must be a whole number, 0 or more`);
  if (!Array.isArray(u.daily)) return [...p, "daily must be a list"];
  if (u.daily.length > MAX_DAYS) p.push("daily has too many days");
  if (isDate(u.periodStart) && isDate(u.periodEnd) && (Date.parse(u.periodEnd) - Date.parse(u.periodStart)) / 864e5 + 1 > MAX_DAYS) p.push("reporting period is longer than " + MAX_DAYS + " days");
  let sumPv = 0, sumVs = 0, last = "";
  for (const d of u.daily) {
    if (!d || typeof d !== "object") { p.push("daily entry is not an object"); continue; }
    for (const k of Object.keys(d)) if (!DAILY_KEYS.includes(k)) p.push(`daily key "${k}" is not allowed`);
    if (!isDate(d.date)) p.push("daily date must be YYYY-MM-DD");
    else {
      if (d.date <= last) p.push("daily dates must be unique and in order");
      last = d.date;
      if (isDate(u.periodStart) && d.date < u.periodStart) p.push("daily date before periodStart");
      if (isDate(u.periodEnd) && d.date > u.periodEnd) p.push("daily date after periodEnd");
    }
    if (!isCount(d.pageViews)) p.push("daily pageViews must be a whole number, 0 or more");
    else sumPv += d.pageViews;
    if (!isCount(d.visits)) p.push("daily visits must be a whole number, 0 or more");
    else {
      sumVs += d.visits;
      if (isCount(d.pageViews) && d.visits > d.pageViews) p.push("daily visits cannot exceed daily page views");
    }
  }
  if (isCount(u.pageViews) && sumPv !== u.pageViews) p.push("daily page views must add up to pageViews");
  if (isCount(u.visits) && sumVs !== u.visits) p.push("daily visits must add up to visits");
  if (isCount(u.visits) && isCount(u.pageViews) && u.visits > u.pageViews) p.push("visits cannot exceed page views");
  if (isDate(u.periodStart) && isDate(u.periodEnd) && u.periodStart > u.periodEnd) p.push("periodStart is after periodEnd");
  if (isDate(u.periodEnd) && isDate(u.updated) && u.updated < u.periodEnd) p.push("updated is before periodEnd");
  const text = JSON.stringify(u);
  if (/SL-[0-9a-f]{12}/i.test(text)) p.push("contains a record identifier");
  if (/\b(country|referr|path|visitor_id|ip|token|secret)\b/i.test(Object.keys(u).join(" "))) p.push("contains a disallowed field");
  return p;
}
