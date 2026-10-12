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
        Source: {providers || "none"}
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
      "Matched research identity",
      c.verifiedIdentity,
      "Official-linked Scholar/ResearchGate profile or successful OpenAlex author match",
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
  recentCitations: "Citations · 2021–2025",
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
  presentation = "table",
  metrics = ["citations", "hIndex", "publications", "recentCitations"],
}: {
  rows: Academic[];
  minN?: number;
  presentation?: "table" | "cards";
  metrics?: NumericMetric[];
}) {
  const summaries = metrics.map((m) => {
    const counts = providerCounts(rows, m);
    const provider = PROVIDER_METRICS.includes(m) ? counts[0]?.[0] : undefined;
    const used = provider ? withProvider(rows, provider).rows : rows;
    return {
      m,
      provider,
      q: quality(used, m, minN),
      v: values(used.map((a) => a[m])),
      excluded: counts.slice(1).reduce((s, [, n]) => s + n, 0),
    };
  });
  if (presentation === "cards")
    return (
      <div className="research-summary">
        <p className="caption">
          Typical value = median (the middle value). At least {minN} profiles
          needed; each metric uses one source.
        </p>
        <div className="research-summary-grid">
          {summaries.map(({ m, provider, q, v, excluded }) => (
            <article className="research-metric-card" key={m}>
              <h3>{metricNames[m] || m}</h3>
              <div className="research-typical-value">
                <strong>{q.lowN ? "—" : fmt(median(v), 1)}</strong>
                <span>
                  {q.valid === 0
                    ? "No data"
                    : q.lowN
                      ? "Too few profiles"
                      : "Typical value"}
                </span>
              </div>
              <div className="research-sample">
                <strong>
                  {q.valid} of {q.eligible} profiles used
                </strong>
                <span>
                  {q.completeness === null
                    ? "—"
                    : q.completeness.toFixed(1) + "%"}
                </span>
                <span className="coverage-track" aria-hidden="true">
                  <i style={{ width: `${q.completeness ?? 0}%` }} />
                </span>
              </div>
              <div className="research-metric-source">
                <span>
                  {provider ||
                    (PROVIDER_METRICS.includes(m)
                      ? "No source available"
                      : "Official profiles")}
                </span>
                {q.valid > 0 && q.weak && (
                  <span className="metric-status is-warning">Limited data</span>
                )}
              </div>
              {excluded > 0 && (
                <details className="metric-source-detail">
                  <summary>{excluded} other-source values omitted</summary>
                  <span>
                    Other sources are kept separate so the median compares
                    values from the same provider.
                  </span>
                </details>
              )}
            </article>
          ))}
        </div>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="metric-summary-table">
        <caption className="caption">
          Median = middle value · One source per metric · Missing values
          excluded
        </caption>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Typical value (median)</th>
            <th>Profiles used</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(({ m, provider, q, v, excluded }) => {
            return (
              <tr key={m}>
                <td>{metricNames[m] || m}</td>
                <td className="numeric">{q.lowN ? "—" : fmt(median(v), 1)}</td>
                <td>
                  <div
                    className="metric-coverage"
                    title={`${q.valid} valid values of ${q.eligible} eligible profiles`}
                  >
                    <strong>
                      {q.completeness === null
                        ? "—"
                        : q.completeness.toFixed(1) + "%"}
                    </strong>
                    <span>
                      {q.valid} of {q.eligible} profiles
                    </span>
                    <span className="coverage-track" aria-hidden="true">
                      <i style={{ width: `${q.completeness ?? 0}%` }} />
                    </span>
                  </div>
                </td>
                <td>
                  {provider ||
                    (PROVIDER_METRICS.includes(m)
                      ? "None"
                      : "Official profile")}
                  {excluded > 0 && (
                    <details className="metric-source-detail">
                      <summary>{excluded} other-source values omitted</summary>
                      <span>
                        Values from other providers are excluded to keep the
                        median comparable.
                      </span>
                    </details>
                  )}
                </td>
                <td>
                  <span
                    className={
                      "metric-status " +
                      (q.lowN || q.weak ? "is-warning" : "is-ready")
                    }
                    title={
                      q.lowN
                        ? `Fewer than ${minN} valid profiles; median not reported.`
                        : q.weak
                          ? "Valid values cover only a small share of the collected profiles."
                          : "Minimum sample and coverage requirements met."
                    }
                  >
                    {q.valid === 0
                      ? "No data"
                      : q.lowN
                        ? "Too few profiles"
                        : q.weak
                          ? "Low coverage"
                          : "Available"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
