import { useMemo, useState } from "react";
import type { Academic, Provider } from "../types";
import { positionStandards, STANDARD_METRICS } from "../analytics/position-standards";
import { fmt } from "./common";

/** Table of how a metric changes with seniority inside any group of academics. */
export function PositionStandards({ rows, minN = 10 }: { rows: Academic[]; minN?: number }) {
  const [metric, setMetric] = useState(STANDARD_METRICS[0].key);
  const [provider, setProvider] = useState<Provider>("Google Scholar");
  const data = useMemo(() => positionStandards(rows, metric, provider), [rows, metric, provider]);
  const top = Math.max(1, ...data.map((r) => r.q3 ?? 0));
  const label = STANDARD_METRICS.find((m) => m.key === metric)!.label;
  return (
    <div className="pos-std">
      <div className="pos-std-controls">
        <div className="chip-group" role="group" aria-label="Measure">
          {STANDARD_METRICS.map((m) => (
            <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="chip-group" role="group" aria-label="Source">
          {(["Google Scholar", "OpenAlex"] as Provider[]).map((p) => (
            <button key={p} type="button" aria-pressed={provider === p} onClick={() => setProvider(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="table-scroll">
        <table className="pos-std-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>People</th>
              <th>With {label.toLowerCase()}</th>
              <th>Median</th>
              <th>Average</th>
              <th>Typical range (middle 50%)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const low = r.n > 0 && r.n < minN;
              return (
                <tr key={r.position} className={r.n === 0 ? "pos-std-empty" : low ? "pos-std-low" : ""}>
                  <th scope="row">{r.position}</th>
                  <td>{fmt(r.people)}</td>
                  <td>{fmt(r.n)}</td>
                  <td>{r.median === null ? "—" : fmt(r.median, 1)}</td>
                  <td>{r.mean === null ? "—" : fmt(r.mean, 1)}</td>
                  <td>
                    {r.q1 === null || r.q3 === null ? (
                      <span className="muted">No values</span>
                    ) : (
                      <span className="pos-range" title={`${fmt(r.q1, 1)} to ${fmt(r.q3, 1)}`}>
                        <i><u style={{ left: `${(100 * r.q1) / top}%`, width: `${Math.max(1.5, (100 * (r.q3 - r.q1)) / top)}%` }} /></i>
                        <b>{fmt(r.q1, 0)}–{fmt(r.q3, 0)}</b>
                      </span>
                    )}
                    {low && <small className="warn-text"> · fewer than {minN}, indicative</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="caption">
        {provider} values only; missing values are skipped, never counted as zero. Senior Lecturer and
        Associate Professor are treated as one position.
      </p>
    </div>
  );
}
