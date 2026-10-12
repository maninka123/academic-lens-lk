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
import { fmt, colors, short } from "./common";
import { Button } from "./ui/button";
import { metricLabels, type NumericMetric } from "../types";
export function Pinned() {
  const { academics } = useData();
  const { pinned, pin, unpin, config, configure, filters, custom } = useAtlas();
  const [search, setSearch] = useState("");
  const available = filterAcademics(academics, filters);
  const selectedRows = compare(available, config, custom).flatMap(
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
        .slice(0, 8)
    : [];
  return (
    <aside className="pinned-panel">
      <div className="section-heading">
        <h2>
          <Pin size={18} />
          Pinned academics
        </h2>
        <span className="pill">{pinned.length}</span>
      </div>
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
                setSearch("");
              }}
            >
              <div>
                <strong>{a.name}</strong>
                <small>
                  {short(a.university)} · {a.rank}
                </small>
              </div>
              <Plus size={18} />
            </button>
          ))}
        </div>
      )}
      {search && !matches.length && (
        <p className="muted">No matching unpinned profiles.</p>
      )}
      <label className="field">
        Compare each person against
        <Select
          aria-label="Peer group"
          value={config.peer}
          onChange={(e) => configure({ peer: e.target.value })}
        >
          {[
            ["current", "Current comparison groups"],
            ["department", "Same department"],
            ["faculty", "Same faculty"],
            ["university", "Same university"],
            ["rank", "Same position in filtered data"],
            ["field", "Same standardised field"],
            ["country", "Same PhD country"],
            ["Public", "Public institutions"],
            ["Non-state", "Non-state institutions"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <p className="caption">
        Peer groups respect global filters and selected comparison groups.
        Unmapped fields and unknown units have no inferred peers.
      </p>
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
      {pinned.map((id, i) => {
        const a = academics.find((a) => a.id === id);
        if (!a) return null;
        const peer = peers(current, a, config.peer);
        const metric = config.metric;
        const numeric = !["count", "phd", "overseas"].includes(metric);
        const v = numeric ? a[metric as NumericMetric] : null;
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
            style={{ borderLeftColor: colors[i % colors.length] }}
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
              {short(a.university)} · {a.rank}
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
                    "person-value" + (v === null ? " unavailable" : "")
                  }
                >
                  <strong>{fmt(v, 1)}</strong>
                  <span>{metricLabels[metric]}</span>
                </div>
                <dl className="peer-stats">
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
                    <dt>From median</dt>
                    <dd>
                      {v === null || stats.median === null
                        ? "—"
                        : fmt(v - stats.median, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt>Percentile</dt>
                    <dd>{pct === null ? "Suppressed" : fmt(pct, 1) + "%"}</dd>
                  </div>
                </dl>
                {stats.n < 5 && (
                  <p className="caption">
                    Fewer than five valid peers; percentile interpretation is
                    suppressed.
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
