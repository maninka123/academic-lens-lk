// Comparability and coverage rules shared by every statistical view.
import type { Academic, NumericMetric, Provider } from "../types";
import { values, groupKey } from "./engine";

/** Below this many valid observations a group is flagged and never ranked. */
export const MIN_SAMPLE = 10;
/** Below this share of eligible records with a value, coverage is weak. */
export const WEAK_COVERAGE = 30;

/** Metrics whose values come from a bibliometric provider. */
export const PROVIDER_METRICS: NumericMetric[] = [
  "publications",
  "citations",
  "recentCitations",
  "hIndex",
];

export function normaliseProvider(source = ""): Provider {
  if (/scholar/i.test(source) && /researchgate/i.test(source)) return "Mixed";
  if (/scholar/i.test(source)) return "Google Scholar";
  if (/researchgate/i.test(source)) return "ResearchGate";
  if (/openalex/i.test(source)) return "OpenAlex";
  return source ? "Other" : "Not recorded";
}

/** Provider of one metric value, from field-level evidence when recorded. */
export function providerOf(a: Academic, metric: NumericMetric): Provider {
  if (!PROVIDER_METRICS.includes(metric)) return "Not recorded";
  if (a[metric] === null) return "Not recorded";
  const e = a.metricEvidence?.find((x) => x.metric === metric);
  if (e) return normaliseProvider(e.source);
  return normaliseProvider(a.metricsSource);
}

/** True only for a successful researcher match ("openalex_matched_…"); attempts, reviews and "unmatched" do not count. */
export const isMatched = (status?: string) =>
  /(^|_)matched(_|$)/.test(status || "") &&
  !/(^|_)(not|no|un)_?matched/.test(status || "");

export type OpenAlexValues = Partial<Record<NumericMetric, number | null>> & {
  status?: string;
};

/**
 * Restrict metric values to one provider. Values from other providers become
 * missing (not zero). For OpenAlex, Sri Lankan values come only from
 * successfully matched researchers in `openAlex`; attempted lookups do not count.
 */
export function withProvider(
  rows: Academic[],
  provider: Provider,
  openAlex?: Map<string, OpenAlexValues>,
) {
  let excluded = 0;
  const out = rows.map((a) => {
    const next: Academic = { ...a };
    for (const m of PROVIDER_METRICS) {
      const native = providerOf(a, m);
      if (native === provider) continue;
      if (provider === "OpenAlex" && openAlex) {
        const o = openAlex.get(a.id);
        const v = o && isMatched(o.status) ? (o[m] ?? null) : null;
        if (a[m] !== null && v === null) excluded++;
        next[m] = v;
        continue;
      }
      if (a[m] !== null) excluded++;
      next[m] = null;
    }
    return next;
  });
  return { rows: out, excluded };
}

/** Providers present for a metric, with counts. */
export function providerCounts(rows: Academic[], metric: NumericMetric) {
  const m = new Map<Provider, number>();
  for (const a of rows) {
    if (a[metric] === null) continue;
    const p = providerOf(a, metric);
    m.set(p, (m.get(p) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export type Quality = {
  eligible: number;
  valid: number;
  missing: number;
  completeness: number | null;
  lowN: boolean;
  weak: boolean;
  providers: [Provider, number][];
  dates: string[];
};
/** Coverage of one metric within one group of eligible records. */
export function quality(
  rows: Academic[],
  metric: NumericMetric,
  min = MIN_SAMPLE,
): Quality {
  const valid = rows.filter((a) => a[metric] !== null);
  const completeness = rows.length ? (100 * valid.length) / rows.length : null;
  const dates = [
    ...new Set(
      valid
        .map((a) => {
          const evidence = a.metricEvidence?.find((e) => e.metric === metric);
          return evidence ? evidence.date : a.collectionDate;
        })
        .filter(Boolean),
    ),
  ].sort();
  return {
    eligible: rows.length,
    valid: valid.length,
    missing: rows.length - valid.length,
    completeness,
    lowN: valid.length < min,
    weak: completeness !== null && completeness < WEAK_COVERAGE,
    providers: providerCounts(valid, metric),
    dates,
  };
}

/** Values usable on a logarithmic axis; non-positive values are reported, not altered. */
export function logSplit(v: (number | null | undefined)[]) {
  const all = values(v);
  const positive = all.filter((x) => x > 0);
  return { positive, excluded: all.length - positive.length };
}

/** Coverage indicators for a set of records. */
export function coverageOf(rows: Academic[]) {
  const verifiedIdentity = rows.filter((a) =>
    Boolean(a.openAlexUrl) || [a.scholarStatus, a.researchgateStatus].some((s) =>
      [
        "verified_official_link",
        "matched_user_supplied_platform_evidence",
      ].includes(s || ""),
    ),
  ).length;
  const verifiedEmployment = rows.filter((a) =>
    ["permanent_officially_listed", "emeritus_officially_listed"].includes(
      a.employmentStatus,
    ),
  ).length;
  const withMetric = rows.filter((a) =>
    (["publications", "citations", "recentCitations", "hIndex"] as const).some(
      (m) => a[m] !== null,
    ),
  ).length;
  const needsReview = rows.filter(
    (a) =>
      /review/i.test(
        `${a.status} ${a.employmentStatus} ${a.scholarStatus} ${a.researchgateStatus}`,
      ) || a.doctorateStatus === "contradictory",
  ).length;
  const missingCore = rows.filter(
    (a) => !a.qualifications && !a.position && withMetricOf(a) === 0,
  ).length;
  return {
    records: rows.length,
    verifiedIdentity,
    verifiedEmployment,
    withMetric,
    withQualifications: rows.filter((a) => a.qualifications).length,
    needsReview,
    missingCore,
  };
}
const withMetricOf = (a: Academic) =>
  (["publications", "citations", "recentCitations", "hIndex"] as const).filter(
    (m) => a[m] !== null,
  ).length;

/** Approximate cross-country career stage of a normalised position. */
export const careerStageOf = (rank: string) =>
  groupKey({ rank } as Academic, "careerStage");
export const CAREER_STAGES = [
  "Professor",
  "Mid-career",
  "Early-career",
  "Teaching / other",
  "Unknown",
];

/**
 * Titles that mean the same seniority in different systems are one position:
 * Sri Lankan "Senior Lecturer" and an international "Associate Professor".
 */
export const SENIOR_LECTURER_GROUP = "Senior Lecturer";
export const equivalentPosition = (rank: string) =>
  rank === "Senior Lecturer" || rank === "Associate Professor"
    ? SENIOR_LECTURER_GROUP
    : rank;
