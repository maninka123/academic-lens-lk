import { Select } from "./ui/select";
import { plotNumber } from "../analytics/plot-format";
import { useState, useId } from "react";
import type { Academic, NumericMetric } from "../types";
import { metricLabels } from "../types";
import {
  buildPeerGroups,
  positionLabel as roleLabel,
  cohortDescription,
  type PeerCohort,
} from "../analytics/profile-peers";
import { PeerDistribution, type PeerChartView } from "./PeerDistribution";
import { Link } from "react-router-dom";
import { MIN_SAMPLE, providerOf } from "../analytics/quality";
import { Card, fmt, standingColor, aheadOf } from "./common";
import { Chart } from "./Chart";

const metrics: NumericMetric[] = [
  "citations",
  "publications",
  "hIndex",
  "recentCitations",
];
const ordinalOf = (v: number) => {
  const n = Math.round(v),
    t = n % 100;
  return (
    n +
    (t >= 11 && t <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th")
  );
};
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
  const [cohort, setCohort] = useState<PeerCohort>("position");
  const [view, setView] = useState<PeerChartView>("benchmarks");
  const [xMetric, setXMetric] = useState<NumericMetric>(
    () =>
      metrics.find(
        (m) =>
          m !== "citations" &&
          Number.isFinite(a[m]) &&
          providerOf(a, m) === providerOf(a, "citations"),
      ) || "publications",
  );
  const helpId = useId();
  const positionLabel = roleLabel(a);
  const { provider, groups } = buildPeerGroups(rows, a, metric, cohort);
  const horizontal =
    xMetric === metric
      ? metric === "publications"
        ? "citations"
        : "publications"
      : xMetric;
  const availableContexts = groups.map((g) => [g.key, g.label]);
  const active =
    groups.find((g) => g.key === context) ||
    groups.find((g) => g.key === "university")!;
  const transform = (v: number | null) =>
    v === null ? null : log ? Math.log10(v + 1) : v;
  return (
    <Card
      title="Where this person stands"
      subtitle="See how this person compares with the selected group of collected profiles."
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
            onChange={(e) => setCohort(e.target.value as PeerCohort)}
          >
            <option value="position">
              Same position | {positionLabel || "Unrecorded"}
            </option>
            <option value="qualification">
              Same qualification | {a.qualification}
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
        <label>
          Chart view
          <Select
            aria-label="Peer chart view"
            value={view}
            onChange={(e) => setView(e.target.value as PeerChartView)}
          >
            <option value="benchmarks">Person, median and mean</option>
            <option value="distribution">Distribution | individual dots</option>
            <option value="scatter">Scatter | two measurements</option>
          </Select>
        </label>
        {view === "scatter" && (
          <label>
            Horizontal measurement
            <Select
              aria-label="Peer horizontal measurement"
              value={horizontal}
              onChange={(e) => setXMetric(e.target.value as NumericMetric)}
            >
              {metrics
                .filter((m) => m !== metric)
                .map((m) => (
                  <option key={m} value={m}>
                    {metricLabels[m]}
                  </option>
                ))}
            </Select>
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
          />
          Compress scale (log₁₀ of value + 1)
        </label>
      </div>
      <div className="peer-scope" aria-live="polite">
        <strong>
          {active.label} | {cohortDescription(a, cohort)}
        </strong>
        <span>
          {active.members.length} group profiles | {active.n} with{" "}
          {metricLabels[metric].toLowerCase()} from {provider}
        </span>
        {active.percentile !== null && (
          <span>
            Percentile: ({active.v.filter((v) => v < a[metric]!).length} below +
            ½ × {active.v.filter((v) => v === a[metric]).length} tied) ÷{" "}
            {active.n} × 100 = {plotNumber(active.percentile)}%
          </span>
        )}
        <details>
          <summary>What do “peer” and “same” mean?</summary>
          <p>
            A peer is a collected profile matching the selected cohort and
            context. “Same” refers to the documented category, such as position,
            qualification or institution; it does not imply identical subjects
            or career histories. Only {provider} values are compared. Missing
            values are excluded, never counted as zero. Groups include this
            person when eligible.
          </p>
          <p>
            Median is the middle value; mean is the average and can be pulled up
            by a few large values. Percentile equals 100 × (values below this
            person + half of tied values) ÷ valid values. Statistics require at
            least {MIN_SAMPLE} valid values.
          </p>
          <p>{active.description}</p>
        </details>
      </div>
      <div className="profile-chart-grid">
        <div>
          <h3>
            {view === "benchmarks"
              ? "Person and peer benchmarks"
              : view === "scatter"
                ? "Two measurements, one profile per dot"
                : "How values are distributed"}
          </h3>
          {view !== "benchmarks" ? (
            <PeerDistribution
              academic={a}
              group={active}
              metric={metric}
              horizontal={horizontal}
              provider={provider}
              view={view}
              log={log}
            />
          ) : (
            <>
              <p className="peer-plot-caption">
                {active.label} | {cohortDescription(a, cohort)} | {provider}
              </p>
              <Chart
                label={`${a.name}: ${metricLabels[metric]} against ${active.label} mean and median`}
                height={340}
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
                          color: i === 2 ? "#e8590c" : "#3b4fd6",
                          borderRadius: [0, 5, 5, 0],
                        },
                      })),
                    },
                  ],
                }}
              />
              <p className="caption">
                The median is the middle value. The mean is the average of the
                same {active.n} available values.
              </p>
            </>
          )}
        </div>
        <div>
          <h3>Standing in each peer group</h3>
          <p className="peer-plot-caption">
            Every group uses {cohortDescription(a, cohort).toLowerCase()}. Hover
            a result for its definition.
          </p>
          {a[metric] === null ? (
            <div className="standing-empty">
              No recorded value for this person.
              <span>Peer medians are available below.</span>
            </div>
          ) : (
            <Chart
              label="Percentile by peer context; shown with at least ten valid values"
              height={340}
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
                      : aheadOf(v),
                },
                grid: { left: 215, right: 165, top: 15, bottom: 50 },
                xAxis: {
                  type: "value",
                  min: 0,
                  max: 100,
                  interval: 50,
                  axisLabel: { formatter: (v: number) => v + "%" },
                  name: "Share of peers this person is ahead of",
                  nameLocation: "middle",
                  nameGap: 30,
                },
                yAxis: {
                  type: "category",
                  inverse: true,
                  data: groups.map((g) => g.label),
                  axisLabel: { width: 205, overflow: "truncate" },
                },
                series: [
                  {
                    type: "bar",
                    barMaxWidth: 22,
                    tooltip: {
                      valueFormatter: (v: number | null) =>
                        v === null ? "Not enough peers" : aheadOf(v),
                    },
                    emphasis: { focus: "none" },
                    // Groups below the minimum sample get a note instead of a bar.
                    data: groups.map((g) =>
                      g.percentile === null
                        ? {
                            value: 0,
                            label: {
                              show: true,
                              position: "right",
                              color: "#8a93ab",
                              formatter:
                                g.members.length === 0
                                  ? "No eligible profiles"
                                  : `Needs ${MIN_SAMPLE} values (has ${g.n})`,
                            },
                          }
                        : {
                            value: g.percentile,
                            itemStyle: { color: standingColor(g.percentile) },
                          },
                    ),
                    itemStyle: { borderRadius: [0, 5, 5, 0] },
                    label: {
                      show: true,
                      position: "right",
                      formatter: (p: any) => aheadOf(p.value),
                    },
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
            <span className="peer-result-scope">
              {g.description.split(" | ")[0]}
            </span>
            <div className="peer-result-main">
              <strong>{g.median === null ? "—" : plotNumber(g.median)}</strong>
              <span>Peer median</span>
            </div>
            {g.percentile !== null ? (
              <div className="peer-percentile">
                <span style={{ color: standingColor(g.percentile) }}>{aheadOf(g.percentile)}</span>
                <i aria-hidden="true">
                  <b style={{ width: `${g.percentile}%`, background: standingColor(g.percentile) }} />
                </i>
              </div>
            ) : (
              <span className="peer-result-note">
                {g.n < MIN_SAMPLE
                  ? g.members.length === 0
                    ? "No eligible profiles"
                    : `Need ${MIN_SAMPLE} valid values`
                  : "Personal value unavailable"}
              </span>
            )}
            <span className="peer-result-sample">
              {g.n} with values / {g.members.length} group profiles
            </span>
          </button>
        ))}
      </div>
      <details className="peer-statistics">
        <summary>
          Profiles behind the selected result ({active.n} with values)
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Records contributing to {active.label} {metricLabels[metric]}{" "}
              statistics
            </caption>
            <thead>
              <tr>
                <th>Academic</th>
                <th>Institution</th>
                <th>{metricLabels[metric]}</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {active.measured
                .filter((r) => Number.isFinite(r[metric]))
                .sort((x, y) => x[metric]! - y[metric]!)
                .map((r) => (
                  <tr
                    key={r.id}
                    className={r.id === a.id ? "peer-person-row" : ""}
                  >
                    <th scope="row">
                      <Link to={`/academics/${r.id}`}>{r.name}</Link>
                      {r.id === a.id && (
                        <span className="pill">This person</span>
                      )}
                    </th>
                    <td>{r.university}</td>
                    <td>{plotNumber(r[metric])}</td>
                    <td>{provider}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
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
                  <td>{a[metric] === null ? "—" : plotNumber(a[metric])}</td>
                  <td>{g.median === null ? "—" : plotNumber(g.median)}</td>
                  <td>{g.mean === null ? "—" : plotNumber(g.mean)}</td>
                  <td>
                    {g.q1 !== null && g.q3 !== null
                      ? `${plotNumber(g.q1)}–${plotNumber(g.q3)}`
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
        {provider && provider !== "Not recorded" ? provider + " | " : ""}At
        least {MIN_SAMPLE} valid values per group | Descriptive comparisons of
        collected profiles
      </p>
    </Card>
  );
}
