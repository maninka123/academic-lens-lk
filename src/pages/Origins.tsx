import { Select } from "../components/ui/select";
import { Globe2, MapPin, Plane } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { Chart, echarts } from "../components/Chart";
import { Header, Card, Stat, fmt, short, Empty, CountryName } from "../components/common";
import { heatDatum, HEAT_RAMP } from "../analytics/heatmap";
import { AcademicTable } from "../components/AcademicTable";
import { MetricSummaryTable } from "../components/Quality";
import { Button } from "../components/ui/button";
import { broadDiscipline } from "../data/disciplines";
import { MIN_SAMPLE } from "../analytics/quality";
import type { Academic } from "../types";

// Validated two-hue pair (blue/orange) plus a neutral for "not recorded".
const ORIGIN = {
  light: { lk: "#2a78d6", overseas: "#eb6834", unknown: "#c5ced6" },
  dark: { lk: "#3987e5", overseas: "#d95926", unknown: "#4a5d6d" },
};
const statusLabel: Record<string, string> = {
  completed_documented: "Completed (documented)",
  in_progress: "In progress",
  contradictory: "Contradictory — needs review",
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

  const mapName = (s: string) =>
    s === "United States" ? "United States of America" : s;
  const mapCountry = (s: string) =>
    s === "United States of America" ? "United States" : s;
  const sankey = useMemo(() => {
    const links = new Map<
        string,
        { source: string; target: string; value: number }
      >(),
      nodes = new Set<string>();
    for (const a of rows) {
      const c = "Country: " + a.phdCountry,
        u = "Current: " + short(a.university),
        p = "PhD: " + (a.phdUniversity || "Institution unavailable");
      const pairs =
        mode === "full"
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
    return { links, nodes };
  }, [rows, mode]);

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
        borderColor: theme === "dark" ? "#161616" : "#fff",
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
  const heat = heatCountries.flatMap((c, x) =>
    heatUnis.flatMap((u, y) => {
      const n = known.filter(
        (a) => a.phdCountry === c && short(a.university) === u,
      ).length;
      return n ? [[x, y, n]] : [];
    }),
  );
  const heatMax = Math.max(1, ...heat.map((h) => h[2] as number));
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
            {d.universities.map((u) => (
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
          detail={`${pct(documented.length, selection.length)} of ${fmt(selection.length)} profiles${sel ? " | " + sel : ""}`}
        />
        <Stat
          label="Awarding country known"
          value={pct(known.length, documented.length)}
          detail={`${known.length} of ${documented.length} | ${known.filter((a) => a.phdCountryInferred).length} inferred from university name`}
        />
        <Stat
          label="Awarding institution known"
          value={pct(
            documented.filter((a) => a.phdUniversity).length,
            documented.length,
          )}
          detail={`${documented.filter((a) => a.phdUniversity).length} of ${documented.length}`}
        />
        <div className="stat origin-split-card" style={{ "--lk": col.lk, "--ov": col.overseas } as React.CSSProperties}>
          <span className="os-label"><Globe2 size={16} aria-hidden="true" /><em>Sri Lanka vs overseas</em></span>
          <div className="os-figures">
            <div className="os-fig lk">
              <i aria-hidden="true"><MapPin size={16} /></i>
              <strong>{pct(lk, known.length)}</strong>
              <small>Sri Lanka</small>
              <small className="os-count">{fmt(lk)} doctorates</small>
            </div>
            <div className="os-fig ov">
              <i aria-hidden="true"><Plane size={16} /></i>
              <strong>{pct(known.length - lk, known.length)}</strong>
              <small>Overseas</small>
              <small className="os-count">{fmt(known.length - lk)} doctorates</small>
            </div>
          </div>
          <div
            className="os-bar"
            role="img"
            aria-label={`${pct(lk, known.length)} Sri Lanka, ${pct(known.length - lk, known.length)} overseas`}
          >
            <u className="lk" style={{ width: `${known.length ? (100 * lk) / known.length : 0}%` }} />
            <u className="ov" style={{ width: `${known.length ? (100 * (known.length - lk)) / known.length : 0}%` }} />
          </div>
          <small className="os-foot">{groups.length} awarding countries</small>
        </div>
      </div>
      <div className="status-strip" aria-label="Doctorate status">
        {Object.entries(statusLabel).map(([k, l]) => (
          <span key={k}>
            <b>{statusCounts[k] || 0}</b> {l}
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
        action={
          country && (
            <Button variant="outline" onClick={() => setCountry("")}>
              Clear <CountryName country={country} />
            </Button>
          )
        }
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
                    return `${mapCountry(p.name)}\n${n > 0 ? `${fmt(n)} recorded doctorates | ${pct(n, known.length)} of mapped profiles` : "No recorded profiles in this selection"}`;
                  },
                },
                visualMap: {
                  type: "piecewise",
                  show: false,
                  pieces: [
                    { min: 1, max: 5, color: "#a9d5dc" },
                    { min: 6, max: 20, color: "#55a8b8" },
                    { min: 21, max: 50, color: "#237e96" },
                    { min: 51, color: "#13516f" },
                  ],
                  outOfRange: {
                    color: theme === "dark" ? "#363636" : "#e3e9ee",
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
                        color: "#e47a30",
                        borderColor: "#fff",
                        borderWidth: 2,
                      },
                      label: {
                        show: true,
                        formatter: "Sri Lanka",
                        position: "bottom",
                        distance: 6,
                        color: theme === "dark" ? "#f5f5f7" : "#1d1d1f",
                        fontSize: 14,
                        fontWeight: 600,
                      },
                      tooltip: {
                        formatter: `Sri Lanka\n${groups.find((g) => g.id === "Sri Lanka")?.rows.length || 0} recorded doctorates`,
                      },
                      data: [{ name: "Sri Lanka", coord: [80.77, 7.87] }],
                    },
                    itemStyle: {
                      areaColor: theme === "dark" ? "#363636" : "#e3e9ee",
                      borderColor: theme === "dark" ? "#1b1b1b" : "#fff",
                      borderWidth: 0.5,
                    },
                    label: { show: false },
                    emphasis: {
                      label: { show: false },
                      itemStyle: {
                        borderColor: theme === "dark" ? "#f5f5f7" : "#607b83",
                        borderWidth: 1,
                      },
                    },
                    data: groups.map((g) => ({
                      name: mapName(g.id),
                      value: g.rows.length,
                      itemStyle:
                        g.id === country
                          ? {
                              areaColor: "#d68129",
                              borderColor: "#a95a13",
                              borderWidth: 2,
                            }
                          : undefined,
                    })),
                  },
                ],
              }}
              onClick={(p) => {
                const next = mapCountry(p.name);
                if (groups.some((g) => g.id === next))
                  setCountry(country === next ? "" : next);
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
                <span>1</span>
                <span>5</span>
                <span>20</span>
                <span>50+</span>
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
              onClick={() => setCountry(country === g.id ? "" : g.id)}
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
                  onClick={() => setCountry(country === g.id ? "" : g.id)}
                >
                  <CountryName country={g.id} />
                  <span>{g.rows.length}</span>
                </Button>
              ))}
            </div>
          </details>
        )}
      </Card>
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
                height={compHeight(byUniversity.length)}
                label={`${scales.institution === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates by institution`}
              />
            </Card>
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
          </div>
          <div className="two-columns align-start">
            <Card
              title="By discipline"
              subtitle="Discipline inferred from faculty/department names — a descriptive grouping, not a verified classification."
            >
              {compositionControls("discipline", "Discipline")}
              <Chart
                option={composition(byDiscipline, "PhD origin by discipline", scales.discipline)}
                height={compHeight(byDiscipline.length)}
                label={`${scales.discipline === "share" ? "Share (%)" : "Count"} of Sri Lankan and overseas doctorates by discipline`}
              />
            </Card>
            <Card
              title="Public and non-state institutions"
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
          <div className="two-columns align-start">
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
            <Card
              title="Awarding country → current institution"
              subtitle="Number of documented doctorates connecting each awarding country (top 12) with current institutions."
            >
              <Chart
                height={Math.max(320, heatUnis.length * 38 + 150)}
                minWidth={680}
                label="Heatmap of awarding countries and current institutions"
                option={{
                  tooltip: {
                    confine: true,
                    formatter: (p: any) =>
                      `${heatCountries[p.value[0]]} -> ${heatUnis[p.value[1]]}\nDoctorates: ${p.data.count}`,
                  },
                  grid: { left: 10, right: 20, top: 10, bottom: 100, containLabel: true },
                  xAxis: {
                    type: "category",
                    data: heatCountries,
                    axisLabel: { rotate: 35, fontSize: 12, interval: 0 },
                    splitArea: { show: false },
                  },
                  yAxis: {
                    type: "category",
                    data: heatUnis,
                    axisLabel: { fontSize: 13 },
                  },
                  visualMap: {
                    min: 0,
                    max: 100,
                    show: true,
                    calculable: false,
                    orient: "horizontal",
                    left: "center",
                    bottom: 4,
                    itemWidth: 14,
                    itemHeight: 200,
                    inRange: { color: HEAT_RAMP },
                    text: ["Most doctorates", "Fewest"],
                    textStyle: { fontSize: 12 },
                  },
                  series: [
                    {
                      type: "heatmap",
                      data: heat.map((h) =>
                        heatDatum(h[0] as number, h[1] as number, (100 * (h[2] as number)) / heatMax, { count: h[2] }),
                      ),
                      label: {
                        show: true,
                        fontSize: 12,
                        formatter: (p: any) => String(p.data.count),
                      },
                    },
                  ],
                }}
              />
            </Card>
          </div>
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
          (mode === "full"
            ? "PhD country → awarding university → current institution"
            : "PhD country → current institution")
        }
        action={
          <Select
            aria-label="Sankey detail"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="simple">Country → current institution</option>
            <option value="full">Include PhD university</option>
          </Select>
        }
      >
        {rows.length ? (
          <div className="flow-chart">
            <Chart
              height={Math.max(
                360,
                Math.max(
                  ...["Country: ", "Current: ", "PhD: "].map(
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
                    right: 200,
                    top: 20,
                    bottom: 20,
                    nodeGap: 12,
                    label: {
                      fontSize: 14,
                      formatter: (p: any) =>
                        p.name.replace(/^(Country|Current|PhD): /, ""),
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
