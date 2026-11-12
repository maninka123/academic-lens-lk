import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Academic } from "../types";
import { fmt } from "./common";

type Mode = "qualification" | "position" | "research";
type Group = { id: string; name: string; short: string; type: "Public" | "Non-state"; rows: Academic[] };

const ROWS = 32; // dots per column: every institution is a block of whole columns this tall
const GAP = 14; // space between institutions
const MIN_PITCH = 5.5;
const MAX_PITCH = 11;

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "qualification", label: "Qualification", note: "Highest qualification recorded on the profile. PhD means a documented completed doctorate." },
  { id: "position", label: "Position", note: "Academic position as published on the staff list." },
  { id: "research", label: "Research data", note: "Whether any publication, citation or h-index value is recorded for the person." },
];
const QUAL = ["PhD", "Masters / MPhil", "Bachelors", "Other documented", "Unknown"];
const QUAL_LABEL = ["PhD documented", "Masters or MPhil", "Bachelors", "Other qualification", "Not recorded"];
const POS = ["Professor ranks", "Senior lecturers", "Lecturers", "Other roles", "Not recorded"];
const RES = ["Has research data", "No research data"];

const category = (a: Academic, mode: Mode): number => {
  if (mode === "qualification") {
    const i = QUAL.indexOf(a.qualification);
    return i < 0 ? QUAL.length - 1 : i;
  }
  if (mode === "position") {
    const r = a.rank;
    if (["Senior Professor", "Professor", "Associate Professor", "Assistant Professor"].includes(r)) return 0;
    if (r === "Senior Lecturer") return 1;
    if (r === "Lecturer" || r === "Assistant Lecturer") return 2;
    if (r === "Unknown") return 4;
    return 3;
  }
  return a.hIndex !== null || a.citations !== null || a.publications !== null ? 0 : 1;
};

const labelsOf = (mode: Mode) => (mode === "qualification" ? QUAL_LABEL : mode === "position" ? POS : RES);

/** One dot for every collected profile, grouped by institution. The only visual that shows the whole dataset at once. */
export function OverviewLandscape({ groups }: { groups: Group[] }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("qualification");
  const [active, setActive] = useState<string | null>(null);
  const [width, setWidth] = useState(1100);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") { setWidth(Math.round(el.clientWidth) || 1100); return; }
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.clientWidth) || 1100);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() => [...groups].filter((g) => g.rows.length).sort((a, b) => b.rows.length - a.rows.length), [groups]);
  const totalCols = sorted.reduce((s, g) => s + Math.ceil(g.rows.length / ROWS), 0);
  const gaps = Math.max(0, sorted.length - 1) * GAP;
  const fit = (width - gaps) / Math.max(1, totalCols);
  const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, fit));
  const radius = pitch * 0.36;
  const layoutWidth = totalCols * pitch + gaps;
  const offset = Math.max(0, (width - layoutWidth) / 2);
  const labels = labelsOf(mode);

  const columns = useMemo(() => {
    let x = 0;
    return sorted.map((g) => {
      const cols = Math.ceil(g.rows.length / ROWS);
      const cats = g.rows.map((a) => category(a, mode)).sort((a, b) => a - b);
      const col = { g, x, cols, cats, w: cols * pitch };
      x += col.w + GAP;
      return col;
    });
  }, [sorted, mode, pitch]);

  const totals = useMemo(() => {
    const t = new Array(labels.length).fill(0) as number[];
    for (const g of sorted) for (const a of g.rows) t[category(a, mode)]++;
    return t;
  }, [sorted, mode, labels.length]);
  const total = totals.reduce((s, v) => s + v, 0);

  const detail = (g: Group) => {
    const n = g.rows.length;
    const phd = g.rows.filter((a) => a.qualification === "PhD").length;
    const res = g.rows.filter((a) => a.hIndex !== null || a.citations !== null || a.publications !== null).length;
    return { n, phd, res };
  };
  const hover = columns.find((c) => c.g.id === active);
  const hoverInfo = hover ? detail(hover.g) : null;
  // Each name is centred under its column, or right-aligned when that would run off the panel.
  // Names take the first free row, so thin neighbouring columns never collide.
  const LANE = 26;
  const laneEnds: number[] = [];
  // A long name under a thin column becomes initials (the full name stays in the card and aria-label).
  const labelFor = (c: { g: Group; w: number }) =>
    c.g.short.length > 9 && c.w < c.g.short.length * 6.6 * 0.6
      ? c.g.name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("")
      : c.g.short;
  const places = columns.map((c) => {
    const w = Math.max(30, labelFor(c).length * 6.6);
    const mid = offset + c.x + c.w / 2;
    const atEdge = mid + w / 2 > width - 2;
    const start = atEdge ? width - 2 - w : mid - w / 2;
    let lane = laneEnds.findIndex((end) => start >= end + 3);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = start + w;
    return { mid, text: labelFor(c), lx: atEdge ? width - 2 : mid, anchor: atEdge ? ("end" as const) : ("middle" as const), lane };
  });
  const lanes = places.map((p) => p.lane);
  const laneCount = Math.max(1, laneEnds.length);
  const height = ROWS * pitch + 16 + laneCount * LANE;

  return (
    <section className="landscape" aria-label="Every collected profile, by institution">
      <header className="landscape-head">
        <div>
          <h2>Every collected profile, by institution</h2>
          <p>Each dot is one person on a published staff list. These are collected profiles, not the total academic population.</p>
        </div>
        <div className="chip-group" role="group" aria-label="Colour the dots by">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
      </header>
      <div className="landscape-scroll">
        <div className="landscape-stage" ref={box} style={{ minWidth: Math.ceil(totalCols * MIN_PITCH + gaps) }}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Dots grouped by institution" onMouseLeave={() => setActive(null)}>
            {columns.map((c, ci) => {
              const cx = offset + c.x;
              const dim = active !== null && active !== c.g.id;
              return (
                <g
                  key={c.g.id}
                  className={"ls-col" + (dim ? " is-dim" : "") + (active === c.g.id ? " is-active" : "")}
                  style={{ animationDelay: `${ci * 45}ms` }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${c.g.name}: ${c.g.rows.length} collected profiles. Open the institution.`}
                  onMouseEnter={() => setActive(c.g.id)}
                  onFocus={() => setActive(c.g.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => nav("/university/" + c.g.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav("/university/" + c.g.id); } }}
                >
                  <rect x={cx - 3} y={0} width={c.w + 6} height={ROWS * pitch + 8} rx={4} className="ls-hit" />
                  {c.cats.map((cat, i) => {
                    const col = Math.floor(i / ROWS), row = i % ROWS;
                    return <circle key={i} className={"ls-dot c" + cat} cx={cx + col * pitch + pitch / 2} cy={(ROWS - 1 - row) * pitch + pitch / 2 + 4} r={radius} />;
                  })}
                  {(() => {
                    const pl = places[ci];
                    const y = ROWS * pitch + 26 + pl.lane * LANE;
                    return (
                      <>
                        {pl.lane > 0 && <line className="ls-tick" x1={pl.mid} x2={pl.mid} y1={ROWS * pitch + 6} y2={y - 12} />}
                        <text x={pl.lx} y={y} textAnchor={pl.anchor} className="ls-label">{pl.text}</text>
                        <text x={pl.lx} y={y + 12} textAnchor={pl.anchor} className="ls-count">{fmt(c.g.rows.length)}</text>
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
          {hover && hoverInfo && (
            <div className="ls-card" role="status" style={{ left: Math.min(Math.max(offset + hover.x + hover.w / 2, 120), Math.max(120, width - 120)), top: 6 }}>
              <strong>{hover.g.name}</strong>
              <span className="ls-card-sector">{hover.g.type === "Public" ? "Public university" : "Non-state institution"}</span>
              <dl>
                <div><dt>Collected profiles</dt><dd>{fmt(hoverInfo.n)}</dd></div>
                <div><dt>Documented PhD</dt><dd>{fmt(hoverInfo.phd)} · {Math.round((100 * hoverInfo.phd) / hoverInfo.n)}%</dd></div>
                <div><dt>With research data</dt><dd>{fmt(hoverInfo.res)} · {Math.round((100 * hoverInfo.res) / hoverInfo.n)}%</dd></div>
              </dl>
              <span className="ls-card-hint">Select to open this institution</span>
            </div>
          )}
        </div>
      </div>
      <footer className="landscape-foot">
        <ul className="ls-legend" aria-label="Key">
          {labels.map((l, i) => (
            <li key={l}><i className={"ls-swatch c" + i} />{l}<b>{fmt(totals[i])}</b><span>{total ? Math.round((100 * totals[i]) / total) : 0}%</span></li>
          ))}
        </ul>
        <p className="ls-note">{MODES.find((m) => m.id === mode)!.note}</p>
      </footer>
    </section>
  );
}
