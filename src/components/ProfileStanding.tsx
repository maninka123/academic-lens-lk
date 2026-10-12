import { Select } from "./ui/select";
import { plotNumber } from "../analytics/plot-format";
import { useState } from "react";
import type { Academic, NumericMetric } from "../types";
import { metricLabels } from "../types";
import { peers, summary, percentile, values } from "../analytics/engine";
import {
  MIN_SAMPLE,
  PROVIDER_METRICS,
  providerOf,
  providerCounts,
  withProvider,
} from "../analytics/quality";
import { Card, fmt } from "./common";
import { Chart } from "./Chart";

const metrics: NumericMetric[] = [
  "citations",
  "publications",
  "hIndex",
  "recentCitations",
  "q1",
  "recentQ1",
];
const contexts = [
  ["department", "Department"],
  ["faculty", "Faculty / school"],
  ["university", "University"],
  ["field", "Same field across institutions"],
  ["rank", "Same position across institutions"],
  ["qualification", "Same qualification"],
  ["sector", "Same institution type"],
  ["all", "Entire collected dataset"],
] as const;
export function ProfileStanding({
  academic: a,
  rows,
}: {
  academic: Academic;
  rows: Academic[];
}) {
  const [metric, setMetric] = useState<NumericMetric>("citations");
  const [context, setContext] = useState<string>("university");
  const [log, setLog] = useState(false);
  const [cohort, setCohort] = useState("position");
  const positionLabel = ["Other", "Unknown"].includes(a.rank)
    ? a.position
    : a.rank;
  const samePosition = (r: Academic) =>
    Boolean(positionLabel) &&
    (["Other", "Unknown"].includes(a.rank)
      ? r.position === a.position
      : r.rank === a.rank);
  const cohortRows = rows.filter(
    (r) =>
      cohort === "all" ||
      (cohort === "position" && samePosition(r)) ||
      (cohort === "qualification" &&
        a.qualification !== "Unknown" &&
        r.qualification === a.qualification) ||
      (cohort === "both" &&
        samePosition(r) &&
        a.qualification !== "Unknown" &&
        r.qualification === a.qualification) ||
      (cohort === "phd" && r.qualification === "PhD"),
  );
  const provider = PROVIDER_METRICS.includes(metric)
    ? a[metric] !== null
      ? providerOf(a, metric)
      : providerCounts(cohortRows, metric)[0]?.[0]
    : undefined;
  const availableContexts = contexts
    .filter(([key]) => key !== "department" || Boolean(a.departmentId))
    .filter(([key]) => key !== "faculty" || Boolean(a.facultyId));
  const groups = availableContexts.map(([key, label]) => {
    const members =
      key === "qualification"
        ? a.qualification === "Unknown"
          ? []
          : cohortRows.filter((r) => r.qualification === a.qualification)
        : key === "sector"
          ? cohortRows.filter((r) => r.type === a.type)
          : key === "rank"
            ? cohortRows.filter(samePosition)
            : peers(cohortRows, a, key);
    const measured = provider ? withProvider(members, provider).rows : members;
    const v = values(measured.map((r) => r[metric]));
    const enough = v.length >= MIN_SAMPLE;
    const stats = summary(v);
    return {
      key,
      label,
      members,
      v,
      ...stats,
      median: enough ? stats.median : null,
      mean: enough ? stats.mean : null,
      q1: enough ? stats.q1 : null,
      q3: enough ? stats.q3 : null,
      percentile: enough ? percentile(v, a[metric]) : null,
    };
  });
  const active =
    groups.find((g) => g.key === context) ||
    groups.find((g) => g.key === "university")!;
  const transform = (v: number | null) =>
    v === null ? null : log ? Math.log10(v + 1) : v;
  return (
    <Card
      title="Where this person stands"
      subtitle="Compare peers by institution, position or qualification."
    >
      <div className="standing-controls">
        <label>
          Profile measurement
          <Select
            aria-label="Profile measurement"
            value={metric}
            onChange={(e) => setMetric(e.target.value as NumericMetric)}
          >
            {metrics.map((m) => (
              <option key={m} value={m}>
                {metricLabels[m]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Compare with
          <Select
            aria-label="Compare with"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
          >
            <option value="position">
              Same position · {positionLabel || "Unrecorded"}
            </option>
            <option value="qualification">
              Same qualification · {a.qualification}
            </option>
            <option value="both">Same position and qualification</option>
            <option value="phd">PhD holders</option>
            <option value="all">All positions and qualifications</option>
          </Select>
        </label>
        <label>
          Peer context
          <Select
            aria-label="Peer context"
            value={active.key}
            onChange={(e) => setContext(e.target.value)}
          >
            {availableContexts.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
          />
          Compress scale (log₁₀ of value + 1)
        </label>
      </div>
      <div className="profile-chart-grid">
        <div>
          <h3>Person and peer benchmarks</h3>
          <Chart
            label={`${a.name}: ${metricLabels[metric]} against ${active.label} mean and median`}
            height={220}
            option={{
              aria: {
                enabled: true,
                description: `${a.name}: ${metricLabels[metric]} ${fmt(a[metric], 1)}. ${active.label} has ${active.n} valid values; median ${fmt(active.median, 1)}, mean ${fmt(active.mean, 1)}. The comparison table contains all values.`,
              },
              tooltip: {
                trigger: "axis",
                renderMode: "richText",
                confine: true,
                valueFormatter: (v: number | null) =>
                  v === null
                    ? "Not available"
                    : plotNumber(log ? Math.pow(10, v) - 1 : v),
              },
              grid: { left: 100, right: 30, bottom: 55, top: 25 },
              xAxis: {
                type: "value",
                name: log ? "log₁₀(value + 1)" : metricLabels[metric],
                nameLocation: "middle",
                nameGap: 35,
              },
              yAxis: {
                type: "category",
                data: ["Peer mean", "Peer median", "This person"],
              },
              series: [
                {
                  type: "bar",
                  barMaxWidth: 30,
                  data: [
                    transform(active.mean),
                    transform(active.median),
                    transform(a[metric]),
                  ].map((value, i) => ({
                    value,
                    itemStyle: {
                      color: i === 2 ? "#169688" : "#2675b9",
                      borderRadius: [0, 5, 5, 0],
                    },
                  })),
                },
              ],
            }}
          />
        </div>
        <div>
          <h3>Standing in each peer group</h3>
          {a[metric] === null ? (
            <div className="standing-empty">
              No recorded value for this person.
              <span>Peer medians are available below.</span>
            </div>
          ) : (
            <Chart
              label="Percentile by peer context; shown with at least ten valid values"
              height={groups.length * 30 + 65}
              option={{
                aria: {
                  enabled: true,
                  description: `Midrank percentiles for ${a.name}. ${groups.map((g) => `${g.label}: ${g.percentile === null ? "unavailable" : fmt(g.percentile, 1) + "%"}, ${g.n} valid values`).join(". ")}. Percentiles require ten valid values.`,
                },
                tooltip: {
                  trigger: "axis",
                  valueFormatter: (v: number) =>
                    v === null
                      ? "Unavailable"
                      : `${plotNumber(v)}th percentile`,
                },
                grid: { left: 110, right: 30, top: 15, bottom: 50 },
                xAxis: {
                  type: "value",
                  min: 0,
                  max: 100,
                  name: "Midrank percentile",
                  nameLocation: "middle",
                  nameGap: 30,
                },
                yAxis: {
                  type: "category",
                  data: groups.map(
                    (g) =>
                      ({
                        department: "Department",
                        faculty: "Faculty",
                        university: "University",
                        field: "Same field",
                        rank: "Same position",
                        qualification: "Qualification",
                        sector: "Same type",
                        all: "All profiles",
                      })[g.key],
                  ),
                },
                series: [
                  {
                    type: "bar",
                    barMaxWidth: 20,
                    data: groups.map((g) => g.percentile),
                    itemStyle: { color: "#169688", borderRadius: [0, 4, 4, 0] },
                  },
                ],
              }}
            />
          )}
        </div>
      </div>
      {a[metric] === null && (
        <p className="profile-notice">
          No {metricLabels[metric].toLowerCase()} value is recorded for this
          person. Their bar and percentiles are unavailable; available peer
          benchmarks remain visible.
        </p>
      )}
      <div className="peer-result-grid" aria-label="Peer results">
        {groups.map((g) => (
          <button
            type="button"
            key={g.key}
            className={
              "peer-result " + (active.key === g.key ? "is-active" : "")
            }
            onClick={() => setContext(g.key)}
            aria-pressed={active.key === g.key}
          >
            <strong className="peer-result-label">{g.label}</strong>
            <div className="peer-result-main">
              <strong>{g.median === null ? "—" : plotNumber(g.median)}</strong>
              <span>Peer median</span>
            </div>
            {g.percentile !== null ? (
              <div className="peer-percentile">
                <span>{plotNumber(g.percentile)}th percentile</span>
                <i aria-hidden="true">
                  <b style={{ width: `${g.percentile}%` }} />
                </i>
              </div>
            ) : (
              <span className="peer-result-note">
                {g.n < MIN_SAMPLE
                  ? "Insufficient data"
                  : "Personal value unavailable"}
              </span>
            )}
            <span className="peer-result-sample">
              {g.n} valid / {g.members.length} profiles
            </span>
          </button>
        ))}
      </div>
      <details className="peer-statistics">
        <summary>Detailed statistics</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Accessible peer comparisons for {a.name}
            </caption>
            <thead>
              <tr>
                <th>Peer context</th>
                <th>Profiles</th>
                <th>Valid values</th>
                <th>This person</th>
                <th>Median</th>
                <th>Mean</th>
                <th>Middle 50%</th>
                <th>Difference from median</th>
                <th>Percentile</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key}>
                  <th scope="row">{g.label}</th>
                  <td>{g.members.length}</td>
                  <td>{g.n}</td>
                  <td>{fmt(a[metric], 1)}</td>
                  <td>{g.median === null ? "—" : fmt(g.median, 1)}</td>
                  <td>{g.mean === null ? "—" : fmt(g.mean, 1)}</td>
                  <td>
                    {g.q1 !== null && g.q3 !== null
                      ? `${fmt(g.q1, 1)}–${fmt(g.q3, 1)}`
                      : "—"}
                  </td>
                  <td>
                    {fmt(
                      a[metric] !== null && g.median !== null
                        ? a[metric]! - g.median
                        : null,
                      1,
                    )}
                  </td>
                  <td>
                    {g.percentile === null ? "—" : `${fmt(g.percentile, 1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="chart-note">
        {provider && provider !== "Not recorded" ? provider + " · " : ""}At
        least {MIN_SAMPLE} valid values per group · Descriptive comparisons of
        collected profiles
      </p>
    </Card>
  );
}
