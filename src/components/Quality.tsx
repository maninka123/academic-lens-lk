import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
} from "lucide-react";
import type { Academic, NumericMetric } from "../types";
import {
  coverageOf,
  providerCounts,
  withProvider,
  quality,
  PROVIDER_METRICS,
  type Quality,
  MIN_SAMPLE,
  WEAK_COVERAGE,
} from "../analytics/quality";
import { values, median } from "../analytics/engine";
import { fmt } from "./common";

export type EvidenceLevel = "verified" | "recorded" | "review" | "missing";
const badgeText: Record<EvidenceLevel, string> = {
  verified: "Verified",
  recorded: "Recorded · unverified",
  review: "Needs review",
  missing: "Not documented",
};
const badgeIcon = {
  verified: CheckCircle2,
  recorded: CircleDashed,
  review: AlertTriangle,
  missing: HelpCircle,
};
/** Compact evidence status shown beside a value. Icon + text, never colour alone. */
export function EvidenceBadge({
  level,
  label,
  title,
}: {
  level: EvidenceLevel;
  label?: string;
  title?: string;
}) {
  const Icon = badgeIcon[level];
  return (
    <span className={"evidence-badge " + level} title={title}>
      <Icon size={13} aria-hidden="true" />
      {label || badgeText[level]}
    </span>
  );
}

/** One-line measurement context for a statistic or chart. */
export function MeasurementNote({
  q,
  metricLabel,
  date,
  children,
}: {
  q: Quality;
  metricLabel: string;
  date?: string;
  children?: ReactNode;
}) {
  const providers = q.providers.map(([p, n]) => `${p} (${n})`).join(", ");
  const dates = date || (q.dates.length ? q.dates.join(", ") : "not recorded");
  return (
    <div className={"measurement-note" + (q.lowN || q.weak ? " warn" : "")}>
      <span>
        <strong>{metricLabel}:</strong> {fmt(q.valid)} valid of{" "}
        {fmt(q.eligible)} eligible records (
        {q.completeness === null ? "—" : fmt(q.completeness, 1) + "%"}) ·
        Source: {providers || "none"} · Measured: {dates}
      </span>
      {q.lowN && (
        <span className="warn-text">
          <AlertTriangle size={14} aria-hidden="true" /> Fewer than {MIN_SAMPLE}{" "}
          valid observations: indicative only, not ranked.
        </span>
      )}
      {!q.lowN && q.weak && (
        <span className="warn-text">
          <AlertTriangle size={14} aria-hidden="true" /> Weak coverage (under{" "}
          {WEAK_COVERAGE}% of eligible records): the values may not represent
          the group.
        </span>
      )}
      {children}
    </div>
  );
}

/** Coverage indicators for a university, faculty or department view. */
export function CoveragePanel({
  rows,
  rosterNote,
}: {
  rows: Academic[];
  rosterNote?: string;
}) {
  const c = coverageOf(rows);
  const pct = (n: number) =>
    c.records ? fmt((100 * n) / c.records, 1) + "%" : "—";
  const items: [string, number, string][] = [
    [
      "Collected records",
      c.records,
      "Published profiles collected — not the total academic population",
    ],
    [
      "Verified research identity",
      c.verifiedIdentity,
      "Scholar or ResearchGate link confirmed from an official page",
    ],
    [
      "Verified employment",
      c.verifiedEmployment,
      "Permanent or emeritus appointment stated by an official source",
    ],
    [
      "Any research metric",
      c.withMetric,
      "At least one bibliometric value from any provider",
    ],
    [
      "Published qualifications",
      c.withQualifications,
      "Qualification text available from the source",
    ],
    [
      "Needs manual review",
      c.needsReview,
      "Identity, employment or qualification evidence conflicts or is unresolved",
    ],
  ];
  return (
    <section className="coverage-panel" aria-label="Data coverage">
      <div className="coverage-grid">
        {items.map(([label, n, help], i) => (
          <div key={label} title={help}>
            <span>{label}</span>
            <strong>{fmt(n)}</strong>
            <small>{i === 0 ? help : pct(n) + " of collected"}</small>
          </div>
        ))}
      </div>
      <p className="caption">
        {rosterNote ||
          "Directory coverage is incomplete: collected profiles are a subset of staff, not a census."}{" "}
        Missing values are unknown, never zero.
      </p>
    </section>
  );
}

const metricNames: Record<string, string> = {
  citations: "Citations",
  recentCitations: "Citations in window",
  publications: "Publications",
  hIndex: "h-index",
  experience: "Academic experience (years)",
};
/**
 * Medians for a set of records, each computed from a single provider (the most
 * common one for that metric in this group). Values from other providers are
 * counted as excluded, never combined.
 */
export function MetricSummaryTable({
  rows,
  minN = MIN_SAMPLE,
  metrics = [
    "citations",
    "hIndex",
    "publications",
    "recentCitations",
    "experience",
  ],
}: {
  rows: Academic[];
  minN?: number;
  metrics?: NumericMetric[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="caption">
          Medians use one provider per metric; missing values are excluded, not
          treated as zero.
        </caption>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Median</th>
            <th>Valid / eligible</th>
            <th>Completeness</th>
            <th>Source</th>
            <th>Measured</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const counts = providerCounts(rows, m);
            const provider = PROVIDER_METRICS.includes(m)
              ? counts[0]?.[0]
              : undefined;
            const used = provider ? withProvider(rows, provider).rows : rows;
            const q = quality(used, m, minN);
            const v = values(used.map((a) => a[m]));
            const excluded = counts.slice(1).reduce((s, [, n]) => s + n, 0);
            return (
              <tr key={m}>
                <td>{metricNames[m] || m}</td>
                <td className="numeric">{q.lowN ? "—" : fmt(median(v), 1)}</td>
                <td>
                  {q.valid} / {q.eligible}
                </td>
                <td>
                  {q.completeness === null ? "—" : fmt(q.completeness, 1) + "%"}
                </td>
                <td>
                  {provider ||
                    (PROVIDER_METRICS.includes(m)
                      ? "None"
                      : "Official profile")}
                  {excluded > 0 && (
                    <small className="caption">
                      {" "}
                      ({excluded} from other providers excluded)
                    </small>
                  )}
                </td>
                <td className="nowrap">{q.dates.join(", ") || "—"}</td>
                <td className={q.lowN || q.weak ? "flag-cell" : ""}>
                  {q.lowN
                    ? `n < ${minN}: not reported`
                    : q.weak
                      ? "Weak coverage"
                      : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
