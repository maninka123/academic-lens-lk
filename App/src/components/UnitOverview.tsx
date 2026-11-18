import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Academic, NumericMetric } from "../types";
import { Chart } from "./Chart";
import { LayoutGrid } from "lucide-react";
import { facultyIcon } from "./unit-icons";
import { Card, CountryName, fmt } from "./common";
import { Select } from "./ui/select";
import { useAtlas } from "../store";
import { groupRows, summary } from "../analytics/engine";
import { withProvider } from "../analytics/quality";
import { SENIORITY, seniorityBand } from "../analytics/phd-impact";

const MEASURES: [NumericMetric, string][] = [
  ["hIndex", "h-index"],
  ["citations", "Citations"],
  ["recentCitations", "Citations 2021–2025"],
  ["publications", "Publications"],
];
const POSITIONS = [...SENIORITY, "Other roles"] as const;
type PositionName = (typeof POSITIONS)[number];
const POSITION_COLORS = ["#c5ccfa", "#6f7df0", "#2b3aa8", "#aab1c2"];
const hatch = { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -Math.PI / 4, color: "rgba(255,255,255,.6)" };

const positionOf = (a: Academic): PositionName => seniorityBand(a.rank) ?? "Other roles";
const doctorateOf = (a: Academic) =>
  a.doctorateStatus === "completed_documented" ? "completed_documented" : a.doctorateStatus === "in_progress" ? "in_progress" : "none";
const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);

/**
 * Plots shown above a unit's table. With several sub-units (faculties of a university, departments of a
 * faculty) it compares them; with a single department it summarises that department.
 */
const ORIGIN_COLORS = ["#4658d8", "#14937f", "#7a5ad9", "#d08a1a", "#c4344d", "#5b7aa8"];
const ORIGIN_OTHER = "#9aa6f6";
const ORIGIN_UNKNOWN = "#aab1c2";
const TOP_ORIGINS = 5;

/** Doughnut of documented doctorates by awarding country, linked to a ranked country list. */
function DoctorateOrigins({ rows, dark }: { rows: Academic[]; dark: boolean }) {
  const documented = rows.filter((a) => doctorateOf(a) === "completed_documented");
  const inProgress = rows.filter((a) => doctorateOf(a) === "in_progress").length;
  const none = rows.length - documented.length - inProgress;
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const a of documented) {
    const c = (a.phdCountry || "").trim();
    if (!c) unknown += 1;
    else counts.set(c, (counts.get(c) || 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, TOP_ORIGINS);
  const rest = ranked.slice(TOP_ORIGINS);
  const restN = rest.reduce((t, [, n]) => t + n, 0);
  type Slice = { key: string; label: string; n: number; color: string; country?: string };
  const slices: Slice[] = [
    ...top.map(([c, n], i) => ({ key: c, label: c, n, color: ORIGIN_COLORS[i % ORIGIN_COLORS.length], country: c })),
    ...(restN ? [{ key: "other", label: `${rest.length} other ${rest.length === 1 ? "country" : "countries"}`, n: restN, color: ORIGIN_OTHER }] : []),
    ...(unknown ? [{ key: "unknown", label: "Country not recorded", n: unknown, color: ORIGIN_UNKNOWN }] : []),
  ];
  const total = documented.length;
  const share = (n: number) => (total ? Math.round((100 * n) / total) : 0);
  const option = {
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => `${p.name}<br/><b>${p.value}</b> of ${total} documented doctorates (${share(p.value)}%)` },
    legend: { show: false },
    series: [
      {
        type: "pie",
        radius: ["62%", "86%"],
        center: ["50%", "50%"],
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: dark ? "#0e1220" : "#fff", borderWidth: 2 },
        data: slices.map((x) => ({ name: x.label, value: x.n, itemStyle: { color: x.color } })),
      },
    ],
  };
  const top1 = Math.max(1, ...slices.map((x) => x.n));
  return (
    <div className="origins-link">
      <div className="origins-donut">
        <Chart option={option} height={220} label={`Documented doctorates by awarding country: ${total} in total`} />
        <div className="origins-centre" aria-hidden="true">
          <strong>{total}</strong>
          <small>{total === 1 ? "documented PhD" : "documented PhDs"}</small>
        </div>
      </div>
      <span className="origins-connector" aria-hidden="true" />
      <div className="origins-list">
        {total === 0 ? (
          <p className="caption">No documented doctorate in this selection.</p>
        ) : (
          <ol aria-label="Awarding countries, most doctorates first">
            {slices.map((x) => (
              <li key={x.key}>
                <span className="origins-name">
                  <i style={{ background: x.color }} aria-hidden="true" />
                  {x.country ? <CountryName country={x.country} /> : x.label}
                </span>
                <span className="origins-bar" aria-hidden="true"><span style={{ width: `${(100 * x.n) / top1}%`, background: x.color }} /></span>
                <span className="origins-count"><b>{x.n}</b> <small>{share(x.n)}%</small></span>
              </li>
            ))}
          </ol>
        )}
        <p className="origins-foot">
          {documented.length} of {rows.length} ({Math.round(pct(documented.length, rows.length))}%) have a documented PhD
          {inProgress > 0 ? `; ${inProgress} in progress` : ""}
          {none > 0 ? `; ${none} not documented` : ""}. Shares are of documented doctorates.
        </p>
      </div>
    </div>
  );
}

export function facultyOptions(rows: Academic[]) {
  const m = new Map<string, string>();
  for (const a of rows) if (a.facultyId && !m.has(a.facultyId)) m.set(a.facultyId, a.faculty);
  return [...m].sort((a, b) => a[1].localeCompare(b[1]));
}

/** Faculty dropdown shared by the overview and the table; both read and write the same value. */
export function FacultySelect({ rows, value, onChange }: { rows: Academic[]; value: string; onChange: (v: string) => void }) {
  const faculties = useMemo(() => facultyOptions(rows), [rows]);
  if (faculties.length < 2) return null;
  return (
    <label className="field unit-focus">
      <span className="sr-only">Faculty</span>
      <Select aria-label="Faculty" value={faculties.some(([id]) => id === value) ? value : "all"} onChange={(e) => onChange(e.target.value)}>
        <option value="all"><LayoutGrid className="opt-icon" size={16} aria-hidden="true" /><span>All faculties</span></option>
        {faculties.map(([id, name]) => {
          const { Icon } = facultyIcon(name);
          return (
            <option key={id} value={id}><Icon className="opt-icon" size={16} aria-hidden="true" /><span>{name}</span></option>
          );
        })}
      </Select>
    </label>
  );
}

export function UnitOverviewCard({
  rows, title, subtitle, minN, focus, onFocus,
}: { rows: Academic[]; title: string; subtitle: string; minN: number; focus: string; onFocus: (v: string) => void }) {
  const picked = rows.some((a) => a.facultyId === focus) ? focus : "all";
  const shown = picked === "all" ? rows : rows.filter((a) => a.facultyId === picked);
  return (
    <Card title={picked === "all" ? title : "Overview of departments"} subtitle={subtitle} action={<FacultySelect rows={rows} value={picked} onChange={onFocus} />}>
      <UnitOverview rows={shown} level={picked === "all" ? "faculty" : "department"} minN={minN} overall={picked === "all" ? undefined : rows} />
    </Card>
  );
}

export function UnitOverview({ rows, level, minN, overall }: { rows: Academic[]; level: "faculty" | "department"; minN: number; overall?: Academic[] }) {
  const theme = useAtlas((s) => s.theme);
  const bar = theme === "dark" ? "#8e9cff" : "#5d6cf0";
  const accent = theme === "dark" ? "#e4a73f" : "#e0a02e";
  const [metric, setMetric] = useState<NumericMetric>("hIndex");
  const [statistic, setStatistic] = useState<"median" | "mean">("median");
  const gridRef = useRef<HTMLDivElement>(null);
  /* Faint row guides drawn once across all three charts: measured from the first chart so they line up with every row. */
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const place = () => {
      const first = grid.querySelector<HTMLElement>(".chart-wrap [role='img']");
      const n = Number(grid.dataset.n), h = Number(grid.dataset.h), gt = Number(grid.dataset.top ?? 8);
      if (!first || !n || !h) return;
      const top = first.getBoundingClientRect().top - grid.getBoundingClientRect().top + gt;
      grid.style.setProperty("--gl-top", `${top}px`);
      grid.style.setProperty("--gl-row", `${(h - gt - 46) / n}px`);
      grid.style.setProperty("--gl-n", String(n));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(grid);
    return () => ro.disconnect();
  });
  const measure = MEASURES.find(([k]) => k === metric)![1];
  const statName = statistic === "median" ? "Median" : "Mean";

  const scholar = useMemo(() => withProvider(overall ?? rows, "Google Scholar").rows, [overall, rows]);
  const scholarById = useMemo(() => new Map(scholar.map((a) => [a.id, a])), [scholar]);

  const groups = useMemo(
    () =>
      groupRows(
        rows.filter((a) => (level === "faculty" ? a.facultyId : a.departmentId)),
        level,
      )
        .map((g) => ({ ...g, label: (level === "faculty" ? g.rows[0]?.faculty : g.rows[0]?.department) || g.label }))
        .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label)),
    [rows, level],
  );
  const compare = groups.length >= 2;

  const valuesOf = (list: Academic[]) =>
    list
      .map((a) => scholarById.get(a.id)?.[metric])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const stat = (list: Academic[]) => {
    const v = valuesOf(list);
    const s = summary(v);
    return { n: v.length, value: v.length ? (statistic === "median" ? s.median : s.mean) : null, q1: s.q1, q3: s.q3 };
  };
  const axisLabel = { fontSize: 12, width: 262, overflow: "truncate" as const };
  const shortLabel = (s: string) => s.replace(/^(Faculty|Department|School) of\s+/i, "");

  const metricTip = (label: string, list: Academic[]) => {
    const v = valuesOf(list).sort((a, b) => a - b);
    const s = summary(v);
    return `${label}<br/>${statName} ${measure}: <b>${v.length ? fmt(statistic === "median" ? s.median : s.mean, 1) : "—"}</b><br/>Middle 50%: ${s.q1 === null ? "—" : fmt(s.q1, 1)} to ${s.q3 === null ? "—" : fmt(s.q3, 1)}<br/>${v.length} of ${list.length} people with a Google Scholar value${v.length < minN ? `<br/><i>Fewer than ${minN} values: indicative only</i>` : ""}`;
  };

  /* ---------- several sub-units: compare them ---------- */
  const gridTop = overall ? 24 : 8;
  const overallStat = overall ? stat(overall) : null;
  const overallPhd = overall ? pct(overall.filter((a) => doctorateOf(a) === "completed_documented").length, overall.length) : null;
  const marker = (v: number | null, text: string) =>
    v === null
      ? undefined
      : {
          silent: true,
          symbol: "none",
          lineStyle: { color: accent, type: "dashed", width: 1.5 },
          label: { show: true, position: "start", distance: 4, formatter: text, color: theme === "dark" ? "#f1f3fa" : "#0b1020", fontSize: 12, fontWeight: 600 },
          data: [{ xAxis: v }],
        };
  const heightFor = Math.max(240, groups.length * 44 + 70);
  const stats = groups.map((g) => stat(g.rows));
  const metricOption = {
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => metricTip(groups[p.dataIndex].label, groups[p.dataIndex].rows) },
    grid: { left: 272, right: 56, top: gridTop, bottom: 46, containLabel: false },
    xAxis: { type: "value", name: `${statName} ${measure}`, nameLocation: "middle", nameGap: 34, axisLabel: { margin: 12 }, splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: { type: "category", inverse: true, data: groups.map((g, i) => `${shortLabel(g.label)} (${stats[i].n}/${g.rows.length})`), axisLabel },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data: groups.map((g, i) => ({
          value: stats[i].value,
          itemStyle: { color: bar, opacity: stats[i].n < minN ? 0.55 : 1, decal: stats[i].n && stats[i].n < minN ? hatch : undefined },
        })),
        label: { show: true, position: "right", fontSize: 13, formatter: (p: any) => (p.value === null || p.value === undefined ? "no data" : fmt(p.value, 1)) },
        markLine: marker(overallStat?.value ?? null, `All faculties ${overallStat?.value == null ? "" : fmt(overallStat.value, 1)}`),
      },
    ],
  };

  const mixOf = (list: Academic[]) => {
    const counts = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<PositionName, number>;
    for (const a of list) counts[positionOf(a)] += 1;
    return counts;
  };
  const mixes = groups.map((g) => mixOf(g.rows));
  const phdShare = groups.map((g) => pct(g.rows.filter((a) => doctorateOf(a) === "completed_documented").length, g.rows.length));
  const mixOption = {
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: any) => {
        const i = p.dataIndex;
        const n = mixes[i][p.seriesName as PositionName];
        return `${groups[i].label}<br/>${p.seriesName}: <b>${n}</b> of ${groups[i].rows.length} (${Math.round(pct(n, groups[i].rows.length))}%)`;
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 16, top: gridTop, bottom: 46, containLabel: false },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%", margin: 12 }, splitLine: { lineStyle: { opacity: 0.3 } } },
    yAxis: { type: "category", inverse: true, data: groups.map((g) => g.label), axisLabel: { show: false }, axisTick: { show: false } },
    series: POSITIONS.map((p, i) => ({
      type: "bar",
      name: p,
      stack: "mix",
      barMaxWidth: 28,
      itemStyle: { color: POSITION_COLORS[i] },
      label: { show: true, position: "inside", color: i === 0 || i === 3 ? "#0b1020" : "#fff", fontSize: 12, formatter: (q: any) => (q.value >= 12 ? Math.round(q.value) + "%" : "") },
      data: groups.map((g, k) => pct(mixes[k][p], g.rows.length)),
    })),
  };
  const phdOption = {
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => `${groups[p.dataIndex].label}<br/>Documented doctorate: <b>${Math.round(phdShare[p.dataIndex])}%</b> of ${groups[p.dataIndex].rows.length} profiles` },
    grid: { left: 8, right: 44, top: gridTop, bottom: 46, containLabel: false },
    xAxis: { type: "value", min: 0, max: 100, interval: 50, axisLabel: { formatter: "{value}%", margin: 12 }, splitLine: { lineStyle: { opacity: 0.3 } } },
    yAxis: { type: "category", inverse: true, data: groups.map((g) => g.label), axisLabel: { show: false }, axisTick: { show: false } },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        itemStyle: { color: "#1ea896" },
        data: phdShare,
        label: { show: true, position: "right", fontSize: 12, formatter: (q: any) => Math.round(q.value) + "%" },
        markLine: marker(overallPhd, overallPhd === null ? "" : `All ${Math.round(overallPhd)}%`),
      },
    ],
  };

  /* ---------- one department: describe it ---------- */
  const all = rows;
  const positionCounts = mixOf(all);
  const positionBarOption = {
    tooltip: { trigger: "item", confine: true },
    grid: { left: 8, right: 40, top: 10, bottom: 24, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: { type: "category", inverse: true, data: POSITIONS as unknown as string[], axisLabel: { fontSize: 13 } },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data: POSITIONS.map((p, i) => ({ value: positionCounts[p], itemStyle: { color: POSITION_COLORS[i] === "#c5ccfa" ? "#9ca8f5" : POSITION_COLORS[i] } })),
        label: { show: true, position: "right", fontSize: 13 },
      },
    ],
  };
  const vals = valuesOf(all).sort((a, b) => a - b);
  const histogram = useMemo(() => {
    if (!vals.length) return { bins: [] as string[], counts: [] as number[], medianBin: -1 };
    const max = vals[vals.length - 1];
    const bins = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(vals.length))));
    const step = Math.max(1, Math.ceil((max + 1) / bins));
    const counts = new Array(bins).fill(0);
    for (const v of vals) counts[Math.min(bins - 1, Math.floor(v / step))] += 1;
    const labels = counts.map((_, i) => (step === 1 ? String(i) : `${i * step}–${(i + 1) * step - 1}`));
    const m = summary(vals).median ?? 0;
    return { bins: labels, counts, medianBin: Math.min(bins - 1, Math.floor(m / step)) };
  }, [vals.join(",")]);
  const histOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, valueFormatter: (v: number) => v + " people" },
    grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: "category", data: histogram.bins, name: measure, nameLocation: "middle", nameGap: 28, axisLabel: { fontSize: 12 } },
    yAxis: { type: "value", name: "People", nameLocation: "middle", nameGap: 32, minInterval: 1, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: [
      {
        type: "bar",
        barMaxWidth: 46,
        data: histogram.counts.map((c, i) => ({ value: c, itemStyle: { color: i === histogram.medianBin ? accent : bar } })),
        label: { show: true, position: "top", fontSize: 12 },
      },
    ],
  };
  const byPosition = POSITIONS.map((p) => ({ p, ...stat(all.filter((a) => positionOf(a) === p)) })).filter((x) => x.n > 0 || x.p !== "Other roles");
  const byPositionOption = {
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: any) => {
        const g = byPosition[p.dataIndex];
        return `${g.p}<br/>${statName} ${measure}: <b>${g.value === null ? "—" : fmt(g.value, 1)}</b><br/>${g.n} people with a value${g.n < minN ? `<br/><i>Fewer than ${minN} values: indicative only</i>` : ""}`;
      },
    },
    grid: { left: 8, right: 60, top: 10, bottom: 34, containLabel: true },
    xAxis: { type: "value", name: `${statName} ${measure}`, nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: { type: "category", inverse: true, data: byPosition.map((g) => `${g.p}\nn=${g.n}`), axisLabel: { fontSize: 13, lineHeight: 16 } },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        data: byPosition.map((g) => ({ value: g.value, itemStyle: { color: bar, opacity: g.n < minN ? 0.55 : 1, decal: g.n && g.n < minN ? hatch : undefined } })),
        label: { show: true, position: "right", fontSize: 13, formatter: (p: any) => (p.value === null || p.value === undefined ? "no data" : fmt(p.value, 1)) },
      },
    ],
  };

  const controls = (
    <div className="impact-controls unit-controls">
      <label className="field">
        Measure
        <Select aria-label="Measure" value={metric} onChange={(e) => setMetric(e.target.value as NumericMetric)}>
          {MEASURES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </Select>
      </label>
      <div className="field">
        <span>Statistic</span>
        <div className="chip-group" role="group" aria-label="Statistic">
          {(["median", "mean"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={statistic === s} onClick={() => setStatistic(s)}>
              {s === "median" ? "Median" : "Mean"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  const note = (
    <ul className="point-list caption unit-note">
      <li>Google Scholar figures only. Missing values are left out, never zero. Hatched bars: under {minN} values.</li>
      {compare && stats.some((s) => s.n > 0) && stats.every((s) => s.n <= 2) && (
        <li>Only one or two values per {level}, so mean and median are the same.</li>
      )}
    </ul>
  );

  if (!rows.length) return null;
  if (compare)
    return (
      <>
        {controls}
        <div className="unit-grid3" ref={gridRef} data-n={groups.length} data-h={heightFor} data-top={gridTop}>
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">{statName} {measure}</h3></div>
            <Chart option={metricOption} height={heightFor} label={`${statName} ${measure} for each ${level}`} />
          </div>
          <div className="pos-col">
            <div className="pos-head">
              <h3 className="pos-sub">Staff mix</h3>
              <ul className="pos-key pos-key-row" aria-label="Positions">
                {POSITIONS.map((p, i) => (
                  <li key={p}><i style={{ background: POSITION_COLORS[i] }} /><span><b>{p}</b></span></li>
                ))}
              </ul>
            </div>
            <Chart option={mixOption} height={heightFor} label={`Position mix for each ${level}`} />
          </div>
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">With doctorate</h3></div>
            <Chart option={phdOption} height={heightFor} label={`Share with a documented doctorate for each ${level}`} />
          </div>
        </div>
        {note}
      </>
    );
  return (
    <>
      <div className="pos-grid unit-grid origins-row">
        <div className="pos-col">
          <div className="pos-head"><h3 className="pos-sub">Positions</h3></div>
          <Chart option={positionBarOption} height={250} label="Number of people at each position" />
        </div>
        <div className="pos-col">
          <div className="pos-head"><h3 className="pos-sub">Doctorate origins</h3></div>
          <DoctorateOrigins rows={all} dark={theme === "dark"} />
        </div>
      </div>
      <div className="unit-controls-row">{controls}</div>
      <div className="pos-grid pos-grid-even unit-grid">
        <div className="pos-col">
          <div className="pos-head"><h3 className="pos-sub">Spread of {measure}</h3></div>
          <Chart option={histOption} height={260} label={`Distribution of ${measure}`} />
          <p className="chart-note">Each bar counts people in that range; the orange bar holds the {statistic === "median" ? "median" : "typical"} person.</p>
        </div>
        <div className="pos-col">
          <div className="pos-head"><h3 className="pos-sub">{statName} {measure} by position</h3></div>
          <Chart option={byPositionOption} height={260} label={`${statName} ${measure} at each position`} />
        </div>
      </div>
      {note}
    </>
  );
}
