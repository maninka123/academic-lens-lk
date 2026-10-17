import { useMemo, useState } from "react";
import { useData } from "../data/context";
import { Card, fmt, short } from "./common";
import { Chart } from "./Chart";
import { positionStandards, POSITION_ORDER } from "../analytics/position-standards";
import { SENIOR_LECTURER_GROUP, equivalentPosition, withProvider } from "../analytics/quality";
import { summary, values } from "../analytics/engine";
import type { NumericMetric } from "../types";

const PUBLIC = "#3b4fd6";
const PRIVATE = "#0f9488";
const MIN = 10;
const SHOW = 5;
const POSITIONS = ["Professor", SENIOR_LECTURER_GROUP, "Lecturer"] as const;

/** How the standard for each seniority differs between universities, public and non-state side by side. */
export function StandardsOverview() {
  const { academics, universities } = useData();
  const [metric, setMetric] = useState<NumericMetric>("hIndex");
  const [position, setPosition] = useState<string>("Professor");
  const scoped = useMemo(() => withProvider(academics, "Google Scholar").rows, [academics]);
  const label = metric === "hIndex" ? "h-index" : "Citations";
  const unis = useMemo(
    () =>
      universities
        .map((u) => {
          const v = values(
            scoped
              .filter((a) => a.universityId === u.id && equivalentPosition(a.rank) === position)
              .map((a) => a[metric]),
          );
          return { ...u, n: v.length, median: v.length ? summary(v).median : null };
        })
        .filter((u) => u.n >= SHOW && u.median !== null)
        .sort((a, b) => b.median! - a.median!),
    [scoped, universities, metric, position],
  );
  const sector = (type: string) => {
    const v = values(
      scoped.filter((a) => a.type === type && equivalentPosition(a.rank) === position).map((a) => a[metric]),
    );
    return { n: v.length, median: v.length >= MIN ? summary(v).median : null };
  };
  const pub = sector("Public"),
    pri = sector("Non-state");
  const all = useMemo(() => positionStandards(academics, metric), [academics, metric]);
  const option = {
    tooltip: {
      confine: true,
      formatter: (p: any) =>
        `${p.data.full} (${p.data.type})\nMedian ${label}: ${fmt(p.value, 1)}\nBased on ${p.data.n} profiles${p.data.n < MIN ? "\nFewer than 10: indicative" : ""}`,
    },
    grid: { left: 10, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt(v) } },
    yAxis: { type: "category", inverse: true, data: unis.map((u) => short(u.name)), axisLabel: { fontSize: 13 } },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        label: { show: true, position: "right", formatter: (p: any) => fmt(p.value, 1) },
        data: unis.map((u) => ({
          value: u.median,
          n: u.n,
          type: u.type,
          full: u.name,
          itemStyle: {
            color: u.type === "Public" ? PUBLIC : PRIVATE,
            borderRadius: [0, 5, 5, 0],
            ...(u.n < MIN
              ? { decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -Math.PI / 4, color: "rgba(255,255,255,.55)" } }
              : {}),
          },
        })),
      },
    ],
  };
  return (
    <Card
      title="Standards by position"
      subtitle="How the typical h-index or citation count for each seniority differs between universities. Public and non-state shown separately."
    >
      <div className="std-controls">
        <div className="chip-group" role="group" aria-label="Measure">
          {([["hIndex", "h-index"], ["citations", "Citations"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
        <div className="chip-group" role="group" aria-label="Position">
          {POSITIONS.map((p) => (
            <button key={p} type="button" aria-pressed={position === p} onClick={() => setPosition(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="std-sectors">
        <div className="std-sector public"><small>Public universities</small>
          <strong>{pub.median === null ? "—" : fmt(pub.median, 1)}</strong><span>median {label} | {pub.n} profiles</span></div>
        <div className="std-sector private"><small>Non-state institutions</small>
          <strong>{pri.median === null ? "—" : fmt(pri.median, 1)}</strong><span>median {label} | {pri.n} profiles{pri.median === null ? " (fewer than 10)" : ""}</span></div>
      </div>
      {unis.length ? (
        <Chart option={option} height={Math.max(220, unis.length * 44 + 30)} label={`Median ${label} by university for ${position}`} />
      ) : (
        <p className="caption">Not enough Google Scholar values for this position yet.</p>
      )}
      <div className="benchmark-key">
        <span><i style={{ background: PUBLIC }} />Public</span>
        <span><i style={{ background: PRIVATE }} />Non-state</span>
        <span className="caption">Hatched bars rest on 5–9 profiles and are indicative only; fewer than 5 are not shown.</span>
      </div>
      <h3 className="std-sub">Across all universities</h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Position</th><th>People</th><th>Median {label}</th><th>Average</th></tr></thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.position}>
                <th scope="row">{r.position}</th>
                <td>{fmt(r.people)}</td>
                <td>{r.median === null ? "—" : fmt(r.median, 1)}</td>
                <td>{r.mean === null ? "—" : fmt(r.mean, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption">Google Scholar values only. Missing values are skipped, never zero.</p>
    </Card>
  );
}
