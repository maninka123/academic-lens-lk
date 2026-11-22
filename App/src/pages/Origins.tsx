import { Select } from "../components/ui/select";
import { Globe2, MapPin, Plane } from "lucide-react";
import { PhdImpact } from "../components/PhdImpact";
import { QS_BANDS, qsBandOf } from "../analytics/phd-impact";
import { qsMain } from "../components/QsRank";
import { useEffect, useMemo, useState } from "react";
import { useData, comparableUniversities } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { Chart, echarts } from "../components/Chart";
import { Header, Card, Stat, fmt, short, Empty, CountryName } from "../components/common";
import { heatDatum, HEAT_RAMP } from "../analytics/heatmap";
import { AcademicTable } from "../components/AcademicTable";
import { MetricSummaryTable } from "../components/Quality";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { broadDiscipline } from "../data/disciplines";
import { MIN_SAMPLE } from "../analytics/quality";
import type { Academic } from "../types";

// Two-hue pair (indigo for Sri Lanka, amber for overseas) plus a neutral for "not recorded".
const ORIGIN = {
  light: { lk: "#5d6cf0", overseas: "#e0a02e", unknown: "#c5cad8" },
  dark: { lk: "#8e9cff", overseas: "#e4a73f", unknown: "#3a4258" },
};
const statusLabel: Record<string, string> = {
  completed_documented: "Completed (documented)",
  in_progress: "In progress",
  contradictory: "Contradictory | needs review",
  unknown: "No doctorate documented",
};
type Split = {
  label: string;
  lk: number;
  overseas: number;
  unknown: number;
  total: number;
};
type CompositionScale = "share" | "count";
type CompositionView = "institution" | "position" | "discipline" | "sector";
/** Documented doctorates split into Sri Lankan, overseas and country-unknown. */
function splitBy(rows: Academic[], key: (a: Academic) => string): Split[] {
  const m = new Map<string, Split>();
  for (const a of rows) {
    const k = key(a);
    const s = m.get(k) || {
      label: k,
      lk: 0,
      overseas: 0,
      unknown: 0,
      total: 0,
    };
    s.total++;
    if (!a.phdCountry) s.unknown++;
    else if (a.phdCountry === "Sri Lanka") s.lk++;
    else s.overseas++;
    m.set(k, s);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function Origins() {
  const d = useData();
  const { filters } = useAtlas();
  const theme = useAtlas((s) => s.theme);
  const col = ORIGIN[theme];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const [country, setCountry] = useState(""),
    [breakdownOpen, setBreakdownOpen] = useState(false),
    [showAllAwarded, setShowAllAwarded] = useState(false),
    [awardedSort, setAwardedSort] = useState<"count" | "rank">("count"),
    [heatScale, setHeatScale] = useState<Record<"country" | "rank", CompositionScale>>({ country: "count", rank: "count" }),
    [showAllWorking, setShowAllWorking] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState("simple"),
    [uni, setUni] = useState(""),
    [faculty, setFaculty] = useState(""),
    [department, setDepartment] = useState(""),
    [position, setPosition] = useState("");
  const [scales, setScales] = useState<Record<CompositionView, CompositionScale>>({
    institution: "share", position: "share", discipline: "share", sector: "share",
  });
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/world.geo.json")
      .then((r) => {
        if (!r.ok) throw Error("Map unavailable");
        return r.json();
      })
      .then((g) => {
        echarts.registerMap("world", g);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);
  const base = d.academics;
  const selection = base.filter(
    (a) =>
      (!uni || a.universityId === uni) &&
      (!faculty || a.facultyId === faculty) &&
      (!department || a.departmentId === department) &&
      (!position || a.rank === position),
  );
  const facultyOptions = groupRows(
    base.filter((a) => !uni || a.universityId === uni),
    "faculty",
  );
  const departmentOptions = groupRows(
    base.filter(
      (a) =>
        (!uni || a.universityId === uni) &&
        (!faculty || a.facultyId === faculty),
    ),
    "department",
  );
  // Only documented completed doctorates count as PhD holders.
  const documented = selection.filter(
    (a) => a.doctorateStatus === "completed_documented",
  );
  const known = documented.filter((a) => a.phdCountry);
  const groups = groupRows(known, "phdCountry").sort(
    (a, b) => b.rows.length - a.rows.length,
  );
  const rows = country ? known.filter((a) => a.phdCountry === country) : known;
  const statusCounts = selection.reduce<Record<string, number>>((m, a) => {
    const s = a.doctorateStatus || "unknown";
    m[s] = (m[s] || 0) + 1;
    return m;
  }, {});
  const lk = known.filter((a) => a.phdCountry === "Sri Lanka").length;
  const pct = (n: number, of: number) =>
    of ? fmt((100 * n) / of, 1) + "%" : "—";

  // Selecting a country opens its breakdown; closing the window clears the selection.
  const openCountry = (id: string) => {
    setCountry(id);
    setBreakdownOpen(true);
    setShowAllAwarded(false);
    setShowAllWorking(false);
    setAwardedSort("count");
  };
  const closeBreakdown = (open: boolean) => {
    setBreakdownOpen(open);
    if (!open) setCountry("");
  };

  // Shorter labels for the narrow bars; the full label stays in the tooltip.
  const shortDiscipline = (label: string) =>
    ({ "Engineering & technology": "Engineering", "Management & commerce": "Management", "Social sciences, law & education": "Social sciences & law" } as Record<string, string>)[label] ?? label;
  // Where a country's doctorates sit: discipline, awarding institution and the Sri Lankan university now employing them.
  const breakdown = useMemo(() => {
    if (!country) return null;
    const rowsFor = known.filter((a) => a.phdCountry === country);
    const tally = (key: (a: Academic) => string, drop?: RegExp) => {
      const m = new Map<string, number>();
      for (const a of rowsFor) {
        const k = key(a);
        if (!k || (drop && drop.test(k))) continue;
        m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
    };
    return {
      total: rowsFor.length,
      disciplines: tally((a) => (/^(unclassified|unmapped|unknown)$/i.test(broadDiscipline(a)) ? "Not classified" : broadDiscipline(a))),
      // Only named institutions are listed; doctorates with no recorded institution are left out.
      awardedBy: tally((a) => a.phdUniversity)
        .map((u) => {
          const withRank = rowsFor.find((a) => a.phdUniversity === u.label && qsMain(a));
          const main = withRank ? qsMain(withRank) : null;
          return { ...u, rank: main ? main.replace(/^QS /, "").replace("Not in QS", "Unranked") : "" };
        })
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
      workingAt: tally((a) => a.university),
    };
  }, [country, known]);

  // Best QS rank first (a band sorts by its upper edge); unranked and unrecorded institutions go last.
  const rankValue = (r: string) => {
    const m = r.match(/\d+/);
    return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
  };
  const awardedSorted = breakdown
    ? awardedSort === "rank"
      ? [...breakdown.awardedBy].sort((a, b) => rankValue(a.rank) - rankValue(b.rank) || b.n - a.n || a.label.localeCompare(b.label))
      : breakdown.awardedBy
    : [];

  /** One tooltip layout for every country: name, prominent count, then compact labels. */
  const countryTip = (name: string, n: number) => {
    const safe = name.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    return n > 0
      ? `<div class="tip tip-stat"><div class="tip-title">${safe}</div><div class="tip-big">${fmt(n)}</div><div class="tip-unit">PhD graduates</div><div class="tip-sub">${pct(n, known.length)} of known PhDs</div></div>`
      : `<div class="tip tip-stat"><div class="tip-title">${safe}</div><div class="tip-sub">No PhD graduates in this selection</div></div>`;
  };

  const mapName = (s: string) =>
    s === "United States" ? "United States of America" : s;
  const mapCountry = (s: string) =>
    s === "United States of America" ? "United States" : s;
  // Left column of the flow: the awarding country (default) or the QS 2027 band of the awarding university.
  const [leftBy, setLeftBy] = useState<"country" | "qs">("country");
  const [middleQs, setMiddleQs] = useState(false);
  const sankey = useMemo(() => {
    const links = new Map<
        string,
        { source: string; target: string; value: number }
      >(),
      nodes = new Set<string>();
    // Bands first, in rank order, so the diagram reads from the highest ranked universities down.
    const bandsUsed = leftBy === "qs" || mode === "band";
    if (bandsUsed) for (const b of [...QS_BANDS, "QS rank not located"]) nodes.add("Band: " + b);
    for (const a of rows) {
      const c =
          leftBy === "qs"
            ? "Band: " + (qsBandOf(a) ?? "QS rank not located")
            : "Country: " + a.phdCountry,
        u = "Current: " + short(a.university),
        p =
          mode === "band"
            ? "Band: " + (qsBandOf(a) ?? "QS rank not located")
            : "PhD: " +
          (mode === "fullqs"
            ? (a.phdInstitution || a.phdUniversity || "Institution unavailable") +
              (qsMain(a) ? " (" + qsMain(a) + ")" : "")
            : a.phdUniversity || "Institution unavailable");
      const pairs =
        mode === "full" || mode === "fullqs" || mode === "band"
          ? [
              [c, p],
              [p, u],
            ]
          : [[c, u]];
      for (const [source, target] of pairs) {
        nodes.add(source);
        nodes.add(target);
        const key = source + "→" + target;
        links.set(key, {
          source,
          target,
          value: (links.get(key)?.value || 0) + 1,
        });
      }
    }
    if (bandsUsed) for (const n of [...nodes]) if (n.startsWith("Band: ") && ![...links.values()].some((l) => l.source === n)) nodes.delete(n);
    return { links, nodes };
  }, [rows, mode, leftBy]);

  /** Stacked counts or shares of documented doctorates, with the same population. */
  const composition = (splits: Split[], label: string, scale: CompositionScale) => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      confine: true,
      formatter: (ps: any[]) => {
        const s = splits[ps[0].dataIndex];
        return `${s.label} (${s.total} documented PhDs${s.total < minN ? ", small sample" : ""})<br/>Sri Lanka: ${s.lk} (${pct(s.lk, s.total)})<br/>Overseas: ${s.overseas} (${pct(s.overseas, s.total)})<br/>Country not recorded: ${s.unknown}`;
      },
    },
    legend: { show: false },
    grid: { left: 10, right: 18, top: 8, bottom: 22, containLabel: true },
    xAxis: {
      type: "value",
      max: scale === "share" ? 100 : undefined,
      minInterval: scale === "count" ? 1 : undefined,
      splitNumber: 4,
      axisLabel: { hideOverlap: true, formatter: (v: number) => scale === "share" ? Math.round(v) + "%" : fmt(v, 0) },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: splits.map((s) => s.label),
      axisLabel: { fontSize: 14, width: 150, overflow: "break", lineHeight: 16 },
    },
    aria: { enabled: true, description: `${label}. ${scale === "share" ? "Percentage" : "Number"} of documented doctorates.` },
    media: [{ query: { maxWidth: 380 }, option: {
      xAxis: { splitNumber: 2 },
      yAxis: { axisLabel: { width: 125, overflow: "truncate" } },
    } }],
    series: (
      [
        ["lk", "Awarded in Sri Lanka", col.lk],
        ["overseas", "Awarded overseas", col.overseas],
        ["unknown", "Country not recorded", col.unknown],
      ] as const
    ).map(([k, name, color]) => ({
      type: "bar",
      name,
      stack: "origin",
      barMaxWidth: 18,
      itemStyle: {
        color,
        borderColor: theme === "dark" ? "#0e1220" : "#fff",
        borderWidth: 1,
      },
      data: splits.map((s) => scale === "count" ? s[k] : (s.total ? (100 * s[k]) / s.total : null)),
    })),
  });
  const byUniversity = splitBy(documented, (a) => short(a.university));
  const positionOrder = [
    "Senior Professor",
    "Professor",
    "Associate Professor",
    "Assistant Professor",
    "Senior Lecturer",
    "Lecturer",
    "Assistant Lecturer",
    "Instructor",
    "Other",
    "Unknown",
  ];
  const byPosition = splitBy(documented.filter((a) => !["Instructor", "Unknown", "Other"].includes(a.rank)), (a) => a.rank).sort(
    (a, b) => positionOrder.indexOf(a.label) - positionOrder.indexOf(b.label),
  );
  const originLegend = (
    <div className="origin-composition-key">
      {[
        ["Sri Lanka", col.lk],
        ["Overseas", col.overseas],
        ["Country not recorded", col.unknown],
      ].map(([label, color]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
  const compositionControls = (view: CompositionView, label: string) => (
    <div className="origin-composition-toolbar">
      {originLegend}
      <div className="chart-scale-toggle" role="group" aria-label={`${label} chart scale`}>
        {(["share", "count"] as const).map((scale) => (
          <button
            key={scale}
            type="button"
            aria-pressed={scales[view] === scale}
            onClick={() => setScales((current) => ({ ...current, [view]: scale }))}
          >
            {scale === "share" ? "Share (%)" : "Count"}
          </button>
        ))}
      </div>
    </div>
  );
  const byDiscipline = splitBy(documented, broadDiscipline).filter((g) => !/^(unclassified|unmapped|unknown)$/i.test(g.label));
  const bySector = splitBy(documented, (a) => a.type);
  const topInstitutions = [
    ...documented
      .filter((a) => a.phdUniversity)
      .reduce(
        (m, a) => m.set(a.phdUniversity, (m.get(a.phdUniversity) || 0) + 1),
        new Map<string, number>(),
      )
      .entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const heatCountries = groups.slice(0, 12).map((g) => g.id);
  const heatUnis = [...new Set(known.map((a) => short(a.university)))];
  const RANK_COLS = [...QS_BANDS, "Not located"] as string[];
  /** Counts of doctorates for every (column, institution) pair, plus each institution's total in the same base. */
  const heatGrid = (base: Academic[], cols: string[], colOf: (a: Academic) => string) => {
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const a of base) {
      const u = short(a.university);
      totals.set(u, (totals.get(u) || 0) + 1);
      const c = colOf(a);
      if (cols.includes(c)) counts.set(c + "\u0000" + u, (counts.get(c + "\u0000" + u) || 0) + 1);
    }
    const cells = cols.flatMap((c, x) =>
      heatUnis.flatMap((u, y) => {
        const n = counts.get(c + "\u0000" + u) || 0;
        return n ? [{ x, y, n, total: totals.get(u) || 0 }] : [];
      }),
    );
    return cells;
  };
  const countryCells = heatGrid(known, heatCountries, (a) => a.phdCountry);
  const rankCells = heatGrid(documented, RANK_COLS, (a) => qsBandOf(a) ?? "Not located");
  const heatPct = (n: number, total: number) => (total ? (100 * n) / total : 0);
  /** One heatmap option: counts, or each institution's share (%) across the columns. */
  const heatOption = (cols: string[], cells: { x: number; y: number; n: number; total: number }[], scale: CompositionScale, what: string) => {
    const value = (c: { n: number; total: number }) => (scale === "count" ? c.n : heatPct(c.n, c.total));
    const max = Math.max(1, ...cells.map(value));
    return {
      tooltip: {
        confine: true,
        formatter: (p: any) => `${cols[p.value[0]]} -> ${heatUnis[p.value[1]]}\nDoctorates: ${p.data.n}\nShare of ${heatUnis[p.value[1]]}: ${pct(p.data.n, p.data.total)}`,
      },
      grid: { left: 10, right: 20, top: 10, bottom: 46, containLabel: true },
      xAxis: { type: "category", data: cols, axisLabel: { rotate: 35, fontSize: 12, interval: 0 }, splitArea: { show: false } },
      yAxis: { type: "category", data: heatUnis, axisLabel: { fontSize: 13 } },
      visualMap: {
        min: 0, max: 100, show: true, calculable: false, orient: "horizontal", left: "center", bottom: 4, itemWidth: 14, itemHeight: 200,
        inRange: { color: HEAT_RAMP }, text: [scale === "count" ? "Most doctorates" : "Highest share", "Fewest"], textStyle: { fontSize: 12 },
      },
      aria: { enabled: true, description: `${what}. ${scale === "count" ? "Number" : "Share of each institution's"} doctorates.` },
      series: [
        {
          type: "heatmap",
          data: cells.map((c) => heatDatum(c.x, c.y, (100 * value(c)) / max, { n: c.n, total: c.total })),
          label: { show: true, fontSize: 12, formatter: (p: any) => (scale === "count" ? String(p.data.n) : String(Math.round(heatPct(p.data.n, p.data.total)))) },
        },
      ],
    };
  };
  const heatControls = (view: "country" | "rank", label: string) => (
    <div className="origin-composition-toolbar heat-toolbar">
      <div className="chart-scale-toggle" role="group" aria-label={`${label} scale`}>
        {(["count", "share"] as const).map((scale) => (
          <button key={scale} type="button" aria-pressed={heatScale[view] === scale} onClick={() => setHeatScale((cur) => ({ ...cur, [view]: scale }))}>
            {scale === "share" ? "Share (%)" : "Count"}
          </button>
        ))}
      </div>
    </div>
  );
  const compHeight = (n: number) => Math.max(200, n * 30 + 70);
  const sel = [
    uni && d.universities.find((u) => u.id === uni)?.short,
    faculty &&
      facultyOptions.find((f) => f.id === faculty)?.label.split(" | ")[0],
    department &&
      departmentOptions.find((f) => f.id === department)?.label.split(" | ")[0],
    position,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <>
      <Header
        eyebrow="Education across borders"
        title="PhD Origins"
        description="Where recorded doctorates were awarded, and how this differs across institutions, positions and disciplines."
      />
      <div className="global-controls" aria-label="PhD origins selection">
        <label className="field">
          Institution
          <Select
            aria-label="Institution"
            value={uni}
            onChange={(e) => {
              setUni(e.target.value);
              setFaculty("");
              setDepartment("");
            }}
          >
            <option value="">All institutions</option>
            {comparableUniversities(d.universities).map((u) => (
              <option key={u.id} value={u.id}>
                {u.short}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          Faculty
          <Select
            aria-label="Faculty"
            value={faculty}
            onChange={(e) => {
              setFaculty(e.target.value);
              setDepartment("");
            }}
          >
            <option value="">All faculties</option>
            {facultyOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          Department
          <Select
            aria-label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {departmentOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          Academic position
          <Select
            aria-label="Academic position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="">All positions</option>
            {groupRows(base, "rank").map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="stats-grid four">
        <Stat
          label="Documented doctorates"
          value={fmt(documented.length)}
          detail={`${pct(documented.length, selection.length)} of ${fmt(selection.length)} compared profiles${sel ? " | " + sel : ""}`}
        />
        <Stat
          label="Awarding country known"
          value={pct(known.length, documented.length)}
          detail={`${fmt(known.length)} of ${fmt(documented.length)} | ${fmt(known.filter((a) => a.phdCountryInferred).length)} inferred from university name`}
        />
        <Stat
          label="Awarding institution known"
          value={pct(
            documented.filter((a) => a.phdUniversity).length,
            documented.length,
          )}
          detail={`${fmt(documented.filter((a) => a.phdUniversity).length)} of ${fmt(documented.length)}`}
        />
        <div className="stat origin-split-card" style={{ "--lk": col.lk, "--ov": col.overseas } as React.CSSProperties}>
          <span className="os-label"><Globe2 size={16} aria-hidden="true" /><em>Sri Lanka vs overseas</em></span>
          <div
            className="os-bar"
            role="img"
            aria-label={`${pct(lk, known.length)} Sri Lanka (${fmt(lk)}), ${pct(known.length - lk, known.length)} overseas (${fmt(known.length - lk)})`}
          >
            <u className="lk" style={{ width: `${known.length ? (100 * lk) / known.length : 0}%` }}>
              <MapPin size={14} aria-hidden="true" />
              <b>{pct(lk, known.length)}</b>
              <small>Sri Lanka {fmt(lk)}</small>
            </u>
            <u className="ov" style={{ width: `${known.length ? (100 * (known.length - lk)) / known.length : 0}%` }}>
              <Plane size={14} aria-hidden="true" />
              <b>{pct(known.length - lk, known.length)}</b>
              <small>Overseas {fmt(known.length - lk)}</small>
            </u>
          </div>
          <small className="os-foot">{groups.length} awarding countries</small>
        </div>
      </div>
      <div className="status-strip" aria-label="Doctorate status">
        {Object.entries(statusLabel).map(([k, l]) => (
          <span key={k}>
            <b>{fmt(statusCounts[k] || 0)}</b> {l}
          </span>
        ))}
        <details>
          <summary>How this is counted</summary>
          <p>
            Only documented completed doctorates are counted; a title, a doctoral
            institution or ambiguous text is not treated as completion. These are
            observed associations, not proof that where a doctorate was awarded
            changes research performance.
          </p>
        </details>
      </div>
      <Card
        title="A world of academic pathways"
        subtitle={`${fmt(known.length)} documented doctorates across ${groups.length} countries. Select a highlighted country or a country below to explore its academics.`}
      >
        <div className="origins-map-surface">
          {ready ? (
            <Chart
              height={420}
              label="World map of PhD awarding countries"
              option={{
                tooltip: {
                  renderMode: "richText",
                  confine: true,
                  formatter: (p: { name: string; value: unknown }) => {
                    const n =
                      typeof p.value === "number" && Number.isFinite(p.value)
                        ? p.value
                        : 0;
                    return countryTip(mapCountry(p.name), n);
                  },
                },
                visualMap: {
                  type: "piecewise",
                  show: false,
                  pieces: [
                    { min: 1, max: 5, color: "#cfd5fb" },
                    { min: 6, max: 20, color: "#9aa6f6" },
                    { min: 21, max: 50, color: "#5d6cf0" },
                    { min: 51, color: "#2b3aa8" },
                  ],
                  outOfRange: {
                    color: theme === "dark" ? "#232a40" : "#e8ebf3",
                  },
                },
                series: [
                  {
                    type: "map",
                    map: "world",
                    roam: false,
                    left: 12,
                    right: 12,
                    top: 15,
                    bottom: 65,
                    boundingCoords: [
                      [-180, 85],
                      [180, -58],
                    ],
                    selectedMode: false,
                    markPoint: {
                      symbol: "circle",
                      symbolSize: 11,
                      itemStyle: {
                        color: "#e0a02e",
                        borderColor: "#fff",
                        borderWidth: 2,
                      },
                      label: {
                        show: true,
                        formatter: "Sri Lanka",
                        position: "bottom",
                        distance: 6,
                        color: theme === "dark" ? "#f3f5fa" : "#0b1020",
                        fontSize: 14,
                        fontWeight: 600,
                      },
                      tooltip: {
                        formatter: countryTip("Sri Lanka", groups.find((g) => g.id === "Sri Lanka")?.rows.length || 0),
                      },
                      data: [{ name: "Sri Lanka", coord: [80.77, 7.87] }],
                    },
                    itemStyle: {
                      areaColor: theme === "dark" ? "#232a40" : "#e8ebf3",
                      borderColor: theme === "dark" ? "#0e1220" : "#fff",
                      borderWidth: 0.5,
                    },
                    label: { show: false },
                    emphasis: {
                      label: { show: false },
                      itemStyle: {
                        borderColor: theme === "dark" ? "#f3f5fa" : "#6b7490",
                        borderWidth: 1,
                      },
                    },
                    data: groups.map((g) => ({
                      name: mapName(g.id),
                      value: g.rows.length,
                      itemStyle:
                        g.id === country
                          ? {
                              areaColor: "#e0a02e",
                              borderColor: "#9a5b08",
                              borderWidth: 2,
                            }
                          : undefined,
                    })),
                  },
                ],
              }}
              onClick={(p) => {
                const next = mapCountry(p.name);
                if (groups.some((g) => g.id === next)) openCountry(next);
              }}
            />
          ) : error ? (
            <Empty>{error}</Empty>
          ) : (
            <div className="skeleton" style={{ height: 420 }} />
          )}
          <div
            className="origins-map-scale"
            aria-label="Recorded doctorate count colour scale: 1 to 5, 6 to 20, 21 to 50, 51 or more; grey means no records"
          >
            <span>Recorded doctorates</span>
            <div>
              <i />
              <div className="map-scale-ticks">
                <span>1–5</span>
                <span>6–20</span>
                <span>21–50</span>
                <span>51+</span>
              </div>
            </div>
            <span className="map-no-records">
              <i />
              No records
            </span>
          </div>
        </div>
        <p className="muted">
          Colour shows collected profiles, not a country's total PhD output.{" "}
          {documented.length > known.length
            ? `${fmt(documented.length - known.length)} additional doctorates have no recorded country.`
            : ""}
        </p>
        <div className="country-pills origins-top-countries">
          {groups.slice(0, 6).map((g) => (
            <Button
              variant={country === g.id ? "default" : "outline"}
              key={g.id}
              onClick={() => openCountry(g.id)}
            >
              <CountryName country={g.id} />
              <span>{g.rows.length}</span>
            </Button>
          ))}
        </div>
        {groups.length > 6 && (
          <details className="origins-more-countries">
            <summary>More countries ({groups.length - 6})</summary>
            <div className="country-pills">
              {groups.slice(6).map((g) => (
                <Button
                  key={g.id}
                  variant={country === g.id ? "default" : "outline"}
                  onClick={() => openCountry(g.id)}
                >
                  <CountryName country={g.id} />
                  <span>{g.rows.length}</span>
                </Button>
              ))}
            </div>
          </details>
        )}
      </Card>
      {breakdown && (
        <Dialog
          open={breakdownOpen}
          onOpenChange={closeBreakdown}
          title={<CountryName country={country} />}
          className="country-dialog"
        >
          <div className="country-hero">
            <strong>{fmt(breakdown.total)}</strong>
            <div>
              <span>PhD graduates</span>
              <small>{pct(breakdown.total, known.length)} of known PhDs</small>
            </div>
          </div>
          <h3 className="country-section">By discipline</h3>
          <ul className="country-bars" aria-label={`PhD graduates from ${country} by discipline`}>
            {breakdown.disciplines.map((d) => (
              <li key={d.label}>
                <span className="cb-label" title={d.label}>{shortDiscipline(d.label)}</span>
                <span className="cb-track"><i style={{ width: `${Math.max(2, (100 * d.n) / breakdown.total)}%`, background: country === "Sri Lanka" ? col.lk : col.overseas }} /></span>
                <span className="cb-count">{fmt(d.n)}<small>{pct(d.n, breakdown.total)}</small></span>
              </li>
            ))}
          </ul>
          <div className="country-lists">
            <section>
              <div className="cl-head">
                <h3 className="country-section">Awarded by</h3>
                <div className="cl-sort" role="group" aria-label="Sort awarding institutions">
                  <button type="button" aria-pressed={awardedSort === "count"} onClick={() => setAwardedSort("count")}>Graduates</button>
                  <button type="button" aria-pressed={awardedSort === "rank"} onClick={() => setAwardedSort("rank")}>Rank</button>
                </div>
              </div>
              <ol className={showAllAwarded ? "cl-scroll" : undefined}>
                {(showAllAwarded ? awardedSorted : awardedSorted.slice(0, 5)).map((d) => (
                  <li key={d.label}>
                    <span>{d.label}{d.rank && <em className="cl-rank">{d.rank}</em>}</span>
                    <b>{fmt(d.n)}</b>
                  </li>
                ))}
              </ol>
              {breakdown.awardedBy.length > 5 && (
                <button type="button" className="cl-toggle" aria-expanded={showAllAwarded} onClick={() => setShowAllAwarded((v) => !v)}>
                  {showAllAwarded ? "Show fewer" : `Show all ${breakdown.awardedBy.length} institutions`}
                </button>
              )}
            </section>
            <section>
              <h3 className="country-section">Now working at</h3>
              <ol className={showAllWorking ? "cl-scroll" : undefined}>
                {(showAllWorking ? breakdown.workingAt : breakdown.workingAt.slice(0, 5)).map((d) => (
                  <li key={d.label}><span>{d.label}</span><b>{fmt(d.n)}</b></li>
                ))}
              </ol>
              {breakdown.workingAt.length > 5 && (
                <button type="button" className="cl-toggle" aria-expanded={showAllWorking} onClick={() => setShowAllWorking((v) => !v)}>
                  {showAllWorking ? "Show fewer" : `Show all ${breakdown.workingAt.length} universities`}
                </button>
              )}
            </section>
          </div>
          <p className="muted country-note">
            Known-country doctorates under the current filters.
          </p>
        </Dialog>
      )}
      {documented.length === 0 ? (
        <Empty title="No documented doctorates in this selection" />
      ) : (
        <>
          <div className="two-columns align-start">
            <Card
              title="Doctorate origins by institution"
              subtitle={scales.institution === "share" ? "Share of documented doctorates" : "Number of documented doctorates"}
            >
              {compositionControls("institution", "Institution")}
              <Chart
                option={composition(byUniversity, "PhD origin by institution", scales.institution)}
                // Tall enough to line up with the two stacked cards beside it, so neither column leaves empty space.
                height={Math.max(compHeight(byUniversity.length), compHeight(byPosition.length) + compHeight(bySector.length) + 162)}
                label={`${scales.institution === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates by institution`}
              />
            </Card>
            <div className="stack">
              <Card
                title="By academic position"
                subtitle="Highest positions first"
              >
                {compositionControls("position", "Academic position")}
                <Chart
                  option={composition(byPosition, "PhD origin by position", scales.position)}
                  height={compHeight(byPosition.length)}
                  label={`${scales.position === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates by academic position`}
                />
              </Card>
              <Card
                title="State and non-state institutions"
                subtitle="Documented doctorates in each sector."
              >
                {compositionControls("sector", "Institution type")}
                <Chart
                  option={composition(bySector, "PhD origin by sector", scales.sector)}
                  height={compHeight(bySector.length)}
                  label={`${scales.sector === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates in public and non-state institutions`}
                />
              </Card>
            </div>
          </div>
          <Card
            title="By discipline"
            subtitle="Discipline inferred from faculty/department names. A descriptive grouping, not a verified classification."
          >
            {compositionControls("discipline", "Discipline")}
            <Chart
              option={composition(byDiscipline, "PhD origin by discipline", scales.discipline)}
              height={compHeight(byDiscipline.length)}
              label={`${scales.discipline === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates by discipline`}
            />
          </Card>
          <div className="heat-pair">
            <Card
              title="Awarding country → current institution"
              subtitle={heatScale.country === "share" ? "Share of each institution's doctorates by awarding country (top 12)." : "Doctorates by awarding country (top 12) and current institution."}
            >
              {heatControls("country", "Awarding country map")}
              <Chart
                height={Math.max(300, heatUnis.length * 38 + 118)}
                minWidth={560}
                label="Heatmap of awarding countries and current institutions"
                option={heatOption(heatCountries, countryCells, heatScale.country, "Awarding country and current institution")}
              />
            </Card>
            <Card
              title="Awarding university ranking → current institution"
              subtitle={heatScale.rank === "share" ? "Share of each institution's doctorates by QS 2027 band." : "Doctorates by QS 2027 band of the awarding university."}
            >
              {heatControls("rank", "University ranking map")}
              <Chart
                height={Math.max(300, heatUnis.length * 38 + 118)}
                minWidth={360}
                label="Heatmap of awarding university ranking band and current institutions"
                option={heatOption(RANK_COLS, rankCells, heatScale.rank, "Awarding university ranking band and current institution")}
              />
            </Card>
          </div>
          <Card
            title="Most frequently recorded awarding institutions"
            subtitle={`Top ${topInstitutions.length} of ${new Set(documented.map((a) => a.phdUniversity).filter(Boolean)).size} recorded institutions, as published (spelling variants are not merged).`}
          >
            <Chart
              height={Math.max(260, topInstitutions.length * 26 + 50)}
              label="Most frequent PhD awarding institutions"
              option={{
                tooltip: { trigger: "item", confine: true },
                grid: {
                  left: 10,
                  right: 40,
                  top: 10,
                  bottom: 20,
                  containLabel: true,
                },
                xAxis: {
                  type: "value",
                  minInterval: 1,
                  axisLabel: { formatter: (v: number) => String(v) },
                },
                yAxis: {
                  type: "category",
                  inverse: true,
                  data: topInstitutions.map(([n]) => n),
                  axisLabel: {
                    fontSize: 12,
                    width: 230,
                    overflow: "truncate",
                  },
                },
                series: [
                  {
                    type: "bar",
                    barMaxWidth: 16,
                    data: topInstitutions.map(([, n]) => n),
                    itemStyle: { color: col.lk, borderRadius: [0, 4, 4, 0] },
                    label: {
                      show: true,
                      position: "right",
                      formatter: (p: any) => String(p.value),
                    },
                  },
                ],
              }}
            />
          </Card>
        </>
      )}
      <Card
        title={country ? `Research context | ${country}` : "Research context"}
        subtitle={`Research metrics for ${rows.length} documented PhD holders in this selection.`}
      >
        <MetricSummaryTable rows={rows} minN={minN} presentation="cards" />
      </Card>
      <Card
        title="From doctorate to current institution"
        subtitle={
          (country ? country + " | " : "") +
          (leftBy === "qs" ? "University ranking (QS 2027)" : "PhD country") +
          (mode === "band"
            ? " → university ranking (QS 2027) → current institution"
            : mode === "full" || mode === "fullqs"
            ? " → awarding university" + (mode === "fullqs" ? " (with its QS 2027 rank)" : "") + " → current institution"
            : " → current institution")
        }
        action={
          <div className="flow-controls">
            <div className="field">
              <span>Left side</span>
              <div className="chip-group" role="group" aria-label="Left side of the flow">
                {([["country", "Awarding country"], ["qs", "University ranking (QS 2027)"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={leftBy === k} onClick={() => {
                    setLeftBy(k);
                    if (k === "qs" && mode === "band") setMode("simple");
                  }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Middle step</span>
              <div className="chip-group" role="group" aria-label="Middle step">
                {(
                  [
                    ["simple", "None"],
                    ["university", "Awarding university"],
                    ...(leftBy === "country" ? [["band", "University ranking (QS 2027)"]] : []),
                  ] as [string, string][]
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={k === "university" ? mode === "full" || mode === "fullqs" : mode === k}
                    onClick={() => setMode(k === "university" ? (middleQs ? "fullqs" : "full") : k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {(mode === "full" || mode === "fullqs") && (
              <label className="check flow-qs">
                <input
                  type="checkbox"
                  checked={middleQs}
                  onChange={(e) => {
                    setMiddleQs(e.target.checked);
                    setMode(e.target.checked ? "fullqs" : "full");
                  }}
                />
                Show each university&rsquo;s QS 2027 rank
              </label>
            )}
          </div>
        }
      >
        {rows.length ? (
          <div className="flow-chart">
            <Chart
              height={Math.max(
                360,
                Math.max(
                  ...["Country: ", "Current: ", "PhD: ", "Band: "].map(
                    (prefix) =>
                      [...sankey.nodes].filter((n) => n.startsWith(prefix))
                        .length,
                  ),
                ) *
                  26 +
                  40,
              )}
              minWidth={800}
              label="Sankey diagram from PhD country to current institution"
              option={{
                tooltip: { renderMode: "richText" },
                series: [
                  {
                    type: "sankey",
                    left: 20,
                    right: 150,
                    // In the QS view keep the bands in rank order instead of sorting by size.
                    layoutIterations: leftBy === "qs" || mode === "band" ? 0 : 32,
                    top: 4,
                    bottom: 8,
                    nodeGap: 12,
                    label: {
                      fontSize: 14,
                      formatter: (p: any) =>
                        p.name.replace(/^(Country|Current|PhD|Band): /, ""),
                    },
                    data: [...sankey.nodes].map((name) => ({ name })),
                    links: [...sankey.links.values()],
                    lineStyle: { color: "source", opacity: 0.25 },
                    emphasis: { focus: "adjacency" },
                  },
                ],
              }}
            />
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      <PhdImpact documented={documented} minN={minN} col={col} />
      <Card
        title={
          country
            ? `Academics with a documented PhD from ${country}`
            : "Profiles with documented PhD origins"
        }
      >
        <AcademicTable rows={rows} />
      </Card>
    </>
  );
}
