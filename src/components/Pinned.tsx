import { Select } from "./ui/select";
import { useState } from "react";
import { Pin, Search, X, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import {
  peers,
  summary,
  values,
  percentile,
  filterAcademics,
  compare,
} from "../analytics/engine";
import { fmt, personColors, short, standingColor } from "./common";
import { Button } from "./ui/button";
import { metricLabels, type NumericMetric, type Academic } from "../types";
export function Pinned({ comparisonRows, referenceAcademics, otherProvider, providerLabel, showHeading = true }: {
  comparisonRows?: Academic[];
  referenceAcademics?: Academic[];
  /** People whose shown value comes from a provider other than the selected one. */
  otherProvider?: Map<string, string>;
  providerLabel?: string;
  showHeading?: boolean;
} = {}) {
  const { academics } = useData();
  const { pinned, pin, unpin, config, configure, filters, custom } = useAtlas();
  const [search, setSearch] = useState("");
  const available = filterAcademics(academics, filters);
  const selectedRows = comparisonRows ?? compare(available, config, custom).flatMap(
    (g) => g.rows,
  );
  const current = [...new Map(selectedRows.map((a) => [a.id, a])).values()];
  const matches = search
    ? academics
        .filter(
          (a) =>
            [a.name, a.university, a.department]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase()) && !pinned.includes(a.id),
        )
        .slice(0, 12)
    : [];
  return (
    <aside className="pinned-panel">
      {showHeading && <div className="section-heading">
        <h2>
          <Pin size={18} />
          Pinned academics
        </h2>
        <span className="pill">{pinned.length}</span>
      </div>}
      <p className="muted">
        Keep individuals in view as your comparison changes.
      </p>
      <label className="search-box">
        <Search size={18} />
        <input
          aria-label="Add Academic"
          placeholder="Find an academic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!!matches.length && (
        <div className="search-results">
          {matches.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                pin(a.id);
                // The person is added: close the suggestion list.
                setSearch("");
              }}
            >
              <div>
                <strong>{a.name}</strong>
                <small>
                  {short(a.university)} | {a.rank}
                </small>
              </div>
              <Plus size={18} />
            </button>
          ))}
        </div>
      )}
      {matches.length > 1 && (
        <Button variant="outline" onClick={() => matches.forEach((a) => pin(a.id))}>
          <Plus size={16} /> Add all {matches.length} shown
        </Button>
      )}
      <p className="caption" role="status">
        {pinned.length ? `${pinned.length} ${pinned.length === 1 ? "person" : "people"} pinned. Keep searching to add more.` : "Search by name, university or department to add people."}
      </p>
      {search && !matches.length && (
        <p className="muted">No matching unpinned profiles.</p>
      )}
      {!pinned.length && (
        <div className="pin-empty">
          <Pin size={25} />
          <h3>Your reference points</h3>
          <p>
            Add academics to see their metric values and position within a peer
            group.
          </p>
        </div>
      )}
      <div className="pinned-list">
      {pinned.map((id, i) => {
        const a = (referenceAcademics ?? academics).find((a) => a.id === id);
        if (!a) return null;
        // Standing is always measured against the profiles in the current comparison.
        const peer = peers(current, a, "current");
        const metric = config.metric;
        const numeric = !["count", "phd", "overseas"].includes(metric);
        const recordedFrom = otherProvider?.get(id) ?? null;
        const v = numeric && recordedFrom === null ? a[metric as NumericMetric] : null;
        const recorded = numeric && recordedFrom !== null ? a[metric as NumericMetric] : null;
        const stats = summary(
          numeric ? values(peer.map((r) => r[metric as NumericMetric])) : [],
        );
        const pct = percentile(
          numeric ? values(peer.map((r) => r[metric as NumericMetric])) : [],
          v,
        );
        return (
          <div
            className="pinned-card"
            key={id}
            style={{ borderLeftColor: personColors[i % personColors.length] }}
          >
            <div className="section-heading">
              <Link to={"/academics/" + id}>{a.name}</Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={"Remove " + a.name}
                onClick={() => unpin(id)}
              >
                <X size={17} />
              </Button>
            </div>
            <p>
              {short(a.university)} | {a.rank}
            </p>
            <span
              className={
                "reference " + (peer.some((r) => r.id === id) ? "included" : "")
              }
            >
              {peer.some((r) => r.id === id)
                ? "Included in peer group"
                : "External reference"}
            </span>
            {numeric ? (
              <>
                <div
                  className={
                    "person-value" + (v === null && recorded === null ? " unavailable" : "")
                  }
                >
                  <strong>{fmt(v ?? recorded, 1)}</strong>
                  <span>{metricLabels[metric]}</span>
                </div>
                {recorded !== null ? (
                  <p className="caption">
                    {recordedFrom} value, not {providerLabel || "the selected provider"}: not ranked against these peers.
                  </p>
                ) : providerLabel && (
                  <p className="caption">{v === null ? `No recorded ${providerLabel} ${metricLabels[metric]} for this person.` : `${providerLabel} | individual value`}</p>
                )}
                {recorded === null && <dl className="peer-stats">
                  <div>
                    <dt>Peer median</dt>
                    <dd>{fmt(stats.median, 1)}</dd>
                  </div>
                  <div>
                    <dt>Peer mean</dt>
                    <dd>{fmt(stats.mean, 1)}</dd>
                  </div>
                  <div>
                    <dt>25th / 75th</dt>
                    <dd>
                      {stats.n
                        ? `${fmt(stats.q1, 1)} / ${fmt(stats.q3, 1)}`
                        : "Not available"}
                    </dd>
                  </div>
                  <div>
                    <dt>Valid peers</dt>
                    <dd>{stats.n}</dd>
                  </div>
                  <div>
                    <dt>Vs peer median</dt>
                    <dd>
                      {v === null || stats.median === null
                        ? "—"
                        : v === stats.median
                          ? "Equal"
                          : `${fmt(Math.abs(v - stats.median), 1)} ${v > stats.median ? "above" : "below"}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Ahead of</dt>
                    <dd style={pct === null ? undefined : { color: standingColor(pct) }}>
                      {pct === null ? "Not enough peers" : Math.max(1, Math.round(pct)) + "% of peers"}
                    </dd>
                  </div>
                </dl>}
                {recorded === null && stats.n < 5 && (
                  <p className="caption">
                    Fewer than five valid peers; a position is not shown.
                  </p>
                )}
              </>
            ) : (
              <p>
                Individual positioning is available for numeric metrics.
                Qualification percentages describe groups.
              </p>
            )}
          </div>
        );
      })}
      </div>
      <details className="method-note">
        <summary>How percentiles work</summary>
        <p>
          100 × (values below + half of tied values) ÷ valid peers. At least 5
          valid peers are required. Relative citations do not measure overall
          academic or teaching quality.
        </p>
      </details>
    </aside>
  );
}
