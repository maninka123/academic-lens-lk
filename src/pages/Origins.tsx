import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { Chart, echarts } from "../components/Chart";
import { Header, Card, Stat, fmt, short, Empty } from "../components/common";
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
  const base = filterAcademics(d.academics, filters);
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

  /** 100% stacked horizontal bars of Sri Lankan / overseas / unknown country. */
  const composition = (splits: Split[], label: string) => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      confine: true,
      formatter: (ps: any[]) => {
        const s = splits[ps[0].dataIndex];
        return `${s.label} (${s.total} documented PhDs${s.total < minN ? ", small sample" : ""})<br/>Sri Lanka: ${s.lk} (${pct(s.lk, s.total)})<br/>Overseas: ${s.overseas} (${pct(s.overseas, s.total)})<br/>Country not recorded: ${s.unknown}`;
      },
    },
    legend: { top: 0 },
    grid: { left: 10, right: 30, top: 35, bottom: 20, containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: (v: number) => v + "%" },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: splits.map(
        (s) => `${s.label} (n=${s.total}${s.total < minN ? " ⚠" : ""})`,
      ),
      axisLabel: { fontSize: 12, width: 220, overflow: "truncate" },
    },
    aria: { enabled: true, description: label },
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
        borderColor: theme === "dark" ? "#14283a" : "#fff",
        borderWidth: 1,
      },
      data: splits.map((s) => (s.total ? (100 * s[k]) / s.total : null)),
    })),
  });
  const byUniversity = splitBy(documented, (a) => short(a.university));
  const byPosition = splitBy(documented, (a) => a.rank);
  const byDiscipline = splitBy(documented, broadDiscipline);
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
  const compHeight = (n: number) => Math.max(200, n * 30 + 70);
  const sel = [
    uni && d.universities.find((u) => u.id === uni)?.short,
    faculty &&
      facultyOptions.find((f) => f.id === faculty)?.label.split(" · ")[0],
    department &&
      departmentOptions.find((f) => f.id === department)?.label.split(" · ")[0],
    position,
  ]
    .filter(Boolean)
    .join(" · ");

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
          <select
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
          </select>
        </label>
        <label className="field">
          Faculty
          <select
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
          </select>
        </label>
        <label className="field">
          Department
          <select
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
          </select>
        </label>
        <label className="field">
          Academic position
          <select
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
          </select>
        </label>
      </div>
      <div className="stats-grid four">
        <Stat
          label="Documented completed doctorates"
          value={fmt(documented.length)}
          detail={`${pct(documented.length, selection.length)} of ${fmt(selection.length)} collected profiles${sel ? " · " + sel : ""}`}
        />
        <Stat
          label="Awarding country known"
          value={pct(known.length, documented.length)}
          detail={`${known.length} of ${documented.length} documented doctorates`}
        />
        <Stat
          label="Awarding institution known"
          value={pct(
            documented.filter((a) => a.phdUniversity).length,
            documented.length,
          )}
          detail={`${documented.filter((a) => a.phdUniversity).length} of ${documented.length} documented doctorates`}
        />
        <Stat
          label="Awarded in Sri Lanka / overseas"
          value={`${pct(lk, known.length)} / ${pct(known.length - lk, known.length)}`}
          detail={`${lk} Sri Lankan · ${known.length - lk} overseas · ${groups.length} countries`}
        />
      </div>
      <div className="inline-note">
        Doctorate status across {fmt(selection.length)} profiles:{" "}
        {Object.entries(statusLabel)
          .map(([k, l]) => `${l} ${statusCounts[k] || 0}`)
          .join(" · ")}
        . Only documented completed doctorates are counted; a title, a doctoral
        institution or ambiguous text is not treated as completion. Countries
        identify awarding institutions. These are observed associations: they do
        not show that where a doctorate was awarded causes differences in
        research performance.
      </div>
      <Card
        title="A world of academic pathways"
        subtitle={`${fmt(known.length)} documented doctorates across ${groups.length} countries. Select a highlighted country or a country below to explore its academics.`}
        action={
          country && (
            <Button variant="outline" onClick={() => setCountry("")}>
              Clear {country}
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
                  const n = typeof p.value === "number" && Number.isFinite(p.value) ? p.value : 0;
                  return `${mapCountry(p.name)}\n${n > 0 ? `${fmt(n)} recorded doctorates · ${pct(n, known.length)} of mapped profiles` : "No recorded profiles in this selection"}`;
                },
              },
              visualMap: {
                type: "piecewise", show: false,
                pieces: [
                  { min: 1, max: 5, color: "#a9d5dc" },
                  { min: 6, max: 20, color: "#55a8b8" },
                  { min: 21, max: 50, color: "#237e96" },
                  { min: 51, color: "#13516f" },
                ],
                outOfRange: { color: theme === "dark" ? "#304657" : "#e3e9ee" },
              },
              series: [
                {
                  type: "map",
                  map: "world",
                  roam: false,
                  left: 12,
                  right: 12,
                  top: 15,
                  bottom: 15,
                  boundingCoords: [
                    [-180, 85],
                    [180, -58],
                  ],
                  selectedMode: false,
                  itemStyle: {
                    areaColor: theme === "dark" ? "#304657" : "#e3e9ee",
                    borderColor: theme === "dark" ? "#172c3c" : "#fff",
                    borderWidth: 0.5,
                  },
                  label: { show: false },
                  emphasis: { label: { show: false }, itemStyle: { borderColor: "#f29a38", borderWidth: 2 } },
                  data: groups.map((g) => ({
                    name: mapName(g.id),
                    value: g.rows.length,
                    itemStyle: g.id === country ? { areaColor: "#d68129", borderColor: "#a95a13", borderWidth: 2 } : undefined,
                  })),
                },
              ],
            }}
            onClick={(p) => { const next = mapCountry(p.name); if (groups.some((g) => g.id === next)) setCountry(country === next ? "" : next); }}
          />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : (
          <div className="skeleton" style={{ height: 420 }} />
        )}
        <div className="origins-map-key" aria-label="Map colour key: recorded doctorates">
          <span>Recorded doctorates</span>
          {[["#a9d5dc", "1–5"], ["#55a8b8", "6–20"], ["#237e96", "21–50"], ["#13516f", "51+"], [theme === "dark" ? "#304657" : "#e3e9ee", "No records"]].map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
          {country && <span><i style={{ background: "#d68129" }} />Selected</span>}
        </div>
        </div>
        <p className="muted">Colour shows collected profiles, not a country's total PhD output. {documented.length > known.length ? `${fmt(documented.length - known.length)} additional doctorates have no recorded country.` : ""}</p>
        <div className="country-pills origins-top-countries">
          {groups.slice(0, 6).map((g) => (
            <Button
              variant={country === g.id ? "default" : "outline"}
              key={g.id}
              onClick={() => setCountry(country === g.id ? "" : g.id)}
            >
              {g.id}
              <span>{g.rows.length}</span>
            </Button>
          ))}
        </div>
        {groups.length > 6 && <details className="origins-more-countries">
          <summary>More countries ({groups.length - 6})</summary>
          <div className="country-pills">{groups.slice(6).map((g) => <Button key={g.id} variant={country === g.id ? "default" : "outline"} onClick={() => setCountry(country === g.id ? "" : g.id)}>{g.id}<span>{g.rows.length}</span></Button>)}</div>
        </details>}
      </Card>
      {documented.length === 0 ? (
        <Empty title="No documented doctorates in this selection" />
      ) : (
        <>
          <div className="two-columns align-start">
            <Card
              title="Sri Lankan and overseas doctorates by institution"
              subtitle={`Share of documented doctorates. ⚠ marks fewer than ${minN} doctorates.`}
            >
              <Chart
                option={composition(byUniversity, "PhD origin by institution")}
                height={compHeight(byUniversity.length)}
                label="Share of Sri Lankan and overseas doctorates by institution"
              />
            </Card>
            <Card
              title="By academic position"
              subtitle="Normalised positions; original titles stay on each profile."
            >
              <Chart
                option={composition(byPosition, "PhD origin by position")}
                height={compHeight(byPosition.length)}
                label="Share of Sri Lankan and overseas doctorates by academic position"
              />
            </Card>
          </div>
          <div className="two-columns align-start">
            <Card
              title="By discipline"
              subtitle="Discipline inferred from faculty/department names — a descriptive grouping, not a verified classification."
            >
              <Chart
                option={composition(byDiscipline, "PhD origin by discipline")}
                height={compHeight(byDiscipline.length)}
                label="Share of Sri Lankan and overseas doctorates by discipline"
              />
            </Card>
            <Card
              title="Public and non-state institutions"
              subtitle="Documented doctorates in each sector."
            >
              <Chart
                option={composition(bySector, "PhD origin by sector")}
                height={compHeight(bySector.length)}
                label="Share of Sri Lankan and overseas doctorates in public and non-state institutions"
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
                height={Math.max(300, heatUnis.length * 30 + 110)}
                minWidth={620}
                label="Heatmap of awarding countries and current institutions"
                option={{
                  tooltip: {
                    confine: true,
                    formatter: (p: any) =>
                      `${heatCountries[p.value[0]]} → ${heatUnis[p.value[1]]}: ${p.value[2]}`,
                  },
                  grid: {
                    left: 10,
                    right: 20,
                    top: 10,
                    bottom: 90,
                    containLabel: true,
                  },
                  xAxis: {
                    type: "category",
                    data: heatCountries,
                    axisLabel: { rotate: 40, fontSize: 12, interval: 0 },
                  },
                  yAxis: {
                    type: "category",
                    data: heatUnis,
                    axisLabel: { fontSize: 12 },
                  },
                  visualMap: {
                    min: 1,
                    max: Math.max(2, ...heat.map((h) => h[2] as number)),
                    show: false,
                    inRange: { color: ["#dbe8f5", "#104281"] },
                  },
                  series: [
                    {
                      type: "heatmap",
                      data: heat,
                      label: {
                        show: true,
                        fontSize: 11,
                        formatter: (p: any) => String(p.value[2]),
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
        title={country ? `Research context · ${country}` : "Research context"}
        subtitle="Collected metrics of documented PhD holders in this selection. Descriptive only; providers are not combined."
      >
        <MetricSummaryTable rows={rows} minN={minN} />
      </Card>
      <Card
        title="From doctorate to current institution"
        subtitle={
          (country ? country + " · " : "") +
          (mode === "full"
            ? "PhD country → awarding university → current institution"
            : "PhD country → current institution")
        }
        action={
          <select
            aria-label="Sankey detail"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="simple">Country → current institution</option>
            <option value="full">Include PhD university</option>
          </select>
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
