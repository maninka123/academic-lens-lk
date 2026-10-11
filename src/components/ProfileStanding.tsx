import { plotNumber } from "../analytics/plot-format";
import { useState } from "react";
import type { Academic, NumericMetric } from "../types";
import { metricLabels } from "../types";
import { peers, summary, percentile, values } from "../analytics/engine";
import { Card, fmt } from "./common";
import { Chart } from "./Chart";

const metrics: NumericMetric[] = [
  "citations",
  "publications",
  "hIndex",
  "experience",
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
    const v = values(members.map((r) => r[metric]));
    return {
      key,
      label,
      members,
      v,
      ...summary(v),
      percentile: percentile(v, a[metric]),
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
      subtitle="Compare within this person’s hierarchy and choose comparable qualifications or positions. Peers come from the full selected dataset, independently of directory filters."
    >
      <div className="standing-controls">
        <label>
          Profile measurement
          <select
            aria-label="Profile measurement"
            value={metric}
            onChange={(e) => setMetric(e.target.value as NumericMetric)}
          >
            {metrics.map((m) => (
              <option key={m} value={m}>
                {metricLabels[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Compare with
          <select
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
          </select>
        </label>
        <label>
          Peer context
          <select
            aria-label="Peer context"
            value={active.key}
            onChange={(e) => setContext(e.target.value)}
          >
            {availableContexts.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
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
            height={280}
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
          <Chart
            label="Percentile by peer context; suppressed when fewer than five valid values"
            height={groups.length * 34 + 70}
            option={{
              aria: {
                enabled: true,
                description: `Midrank percentiles for ${a.name}. ${groups.map((g) => `${g.label}: ${g.percentile === null ? "unavailable" : fmt(g.percentile, 1) + "%"}, ${g.n} valid values`).join(". ")}. Percentiles require five valid values.`,
              },
              tooltip: {
                trigger: "axis",
                valueFormatter: (v: number) =>
                  v === null ? "Unavailable" : `${plotNumber(v)}th percentile`,
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
        </div>
      </div>
      {a[metric] === null && (
        <p className="profile-notice">
          No {metricLabels[metric].toLowerCase()} value is recorded for this
          person. Their bar and percentiles are unavailable; available peer
          benchmarks remain visible.
        </p>
      )}
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
                <td>{fmt(g.median, 1)}</td>
                <td>{fmt(g.mean, 1)}</td>
                <td>
                  {g.n ? `${fmt(g.q1, 1)}–${fmt(g.q3, 1)}` : "Not available"}
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
                  {g.percentile === null
                    ? "Not available"
                    : `${fmt(g.percentile, 1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        The selected cohort applies at every level; the person is included only
        when they meet that cohort. Unknown department or faculty membership
        produces no peer group. Percentiles use midranks for ties and require at
        least five valid values. Empty charts indicate unavailable evidence, not
        zero. These are descriptive comparisons of collected records, not
        performance ratings; fields, career stage, coverage, and snapshot dates
        affect interpretation.
      </p>
    </Card>
  );
}
