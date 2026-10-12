import { NumericValue } from "../components/common";
import { Select } from "../components/ui/select";
import { useState, useEffect } from "react";
import {
  Share2,
  Download,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Trash2,
} from "lucide-react";
import { useData } from "../data/context";
import { useAtlas, encodeState } from "../store";
import {
  metricLabels,
  selectableMetricLabels,
  levelLabels,
  type Level,
  type Metric,
  type ChartType,
  type Aggregation,
  type NumericMetric,
} from "../types";
import {
  filterAcademics,
  compare,
  groupRows,
  validModes,
} from "../analytics/engine";
import { comparisonChart } from "../analytics/charts";
import { metricDefinitions } from "../analytics/exports";
import { Chart } from "../components/Chart";
import { Filters, Multi } from "../components/Filters";
import { Pinned } from "../components/Pinned";
import { AcademicTable } from "../components/AcademicTable";
import { Header, fmt, exportCsv, Empty } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  benchmarkFields,
  type BenchmarkField,
  loadBenchmarks,
  matchedField,
  tierLabels,
  type SlOpenAlex,
} from "../data/international";
import {
  withProvider,
  providerCounts,
  quality,
  logSplit,
  PROVIDER_METRICS,
  MIN_SAMPLE,
} from "../analytics/quality";
import { MeasurementNote } from "../components/Quality";
import { exportStatistics } from "../analytics/exports";
import type { Academic, Provider } from "../types";
const charts: Record<ChartType, string> = {
  bar: "Bar",
  grouped: "Grouped composition",
  stacked: "Stacked composition",
  percentStacked: "100% stacked composition",
  scatter: "Scatter",
  bubble: "Bubble (size = h-index)",
  box: "Box plot",
  histogram: "Histogram",
  heatmap: "Heatmap",
  treemap: "Treemap",
};
export function Compare() {
  const d = useData();
  const {
    config: c,
    configure,
    setFilters,
    filters,
    pinned,
    custom,
    saveGroup,
    deleteGroup,
  } = useAtlas();
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width:1100px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width:1100px)");
    const handler = () => {
      setMobile(query.matches);
      setLeft(!query.matches);
      setRight(!query.matches && useAtlas.getState().pinned.length > 0);
    };
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  const [left, setLeft] = useState(
      () => !window.matchMedia("(max-width:1100px)").matches,
    ),
    [right, setRight] = useState(
      () =>
        pinned.length > 0 && !window.matchMedia("(max-width:1100px)").matches,
    ),
    [notice, setNotice] = useState(""),
    [groupName, setGroupName] = useState("");
  const [bench, setBench] = useState<Academic[]>([]);
  const [openAlex, setOpenAlex] = useState<Map<string, SlOpenAlex> | null>(
    null,
  );
  const [discipline, setDiscipline] = useState<"all" | BenchmarkField>("all");
  const benchOn =
    Boolean(c.benchmarks) && (c.level === "type" || c.level === "university");
  const providerMetric = PROVIDER_METRICS.includes(c.metric as NumericMetric);
  const single = c.providerMode !== "mixed";
  // Providers that actually supply this metric in the collection. A saved
  // choice with no values for the metric falls back to the dominant provider.
  const available = providerMetric
    ? providerCounts(d.academics, c.metric as NumericMetric).filter(
        ([p]) => p !== "Not recorded" && p !== "Mixed",
      )
    : [];
  const chosen: Provider =
    c.provider === "OpenAlex" || available.some(([p]) => p === c.provider)
      ? (c.provider as Provider)
      : available[0]?.[0] || "OpenAlex";
  // Benchmarks only exist in OpenAlex, so a single-provider comparison that
  // includes them must use OpenAlex for Sri Lanka too.
  const provider: Provider = benchOn ? "OpenAlex" : chosen;
  const needsOpenAlex = benchOn || provider === "OpenAlex";
  useEffect(() => {
    if (!needsOpenAlex || openAlex) return;
    loadBenchmarks()
      .then((b) => setOpenAlex(b.slOpenAlex))
      .catch(() => setOpenAlex(new Map()));
  }, [needsOpenAlex, openAlex]);
  useEffect(() => {
    if (!benchOn || bench.length) return;
    loadBenchmarks()
      .then((b) =>
        setBench(
          b.academics
            .filter((a) => a.unitType !== "proxy")
            .map(
              (a) =>
                ({
                  ...a,
                  universityId: "intl-" + a.universityId,
                  university: `${a.universityShort} · ${a.country} (${a.tier})`,
                  type: `International · ${tierLabels[a.tier]}`,
                  facultyId: "",
                  departmentId: "",
                  qualifications: a.qualifications,
                  phdYear: a.phdYear,
                  phdStatus: a.phdStatus,
                  experience: null,
                  interests: a.interests,
                  q1: null,
                  recentQ1: null,
                  scholarUrl: a.scholarUrl,
                  researchgateUrl: a.researchgateUrl,
                  snapshotDate: "",
                  status: "international_benchmark",
                  employmentStatus: "",
                  notes:
                    "International benchmark. Bibliography reflects source-listed works; citation metrics require a matched research profile.",
                }) as unknown as Academic,
            ),
        ),
      )
      .catch(() => setNotice("International benchmarks could not be loaded."));
  }, [benchOn, bench.length]);
  const filtered = filterAcademics(d.academics, filters).filter(
    (a) => !benchOn || discipline === "all" || matchedField(a) === discipline,
  );
  const provided = single
    ? withProvider(filtered, provider, openAlex || undefined)
    : { rows: filtered, excluded: 0 };
  const rows = [
      ...provided.rows,
      ...(benchOn
        ? bench.filter((a) => discipline === "all" || a.field === discipline)
        : []),
    ],
    groups = compare(rows, c, custom),
    selected = pinned.flatMap((id) => {
      const a = d.academics.find((a) => a.id === id);
      return a ? [a] : [];
    }),
    options = groupRows(rows, c.level, custom);
  const selectedRows = [
    ...new Map(groups.flatMap((g) => g.rows).map((a) => [a.id, a])).values(),
  ];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const logExcluded = ["count", "phd", "overseas"].includes(c.metric)
    ? 0
    : logSplit(selectedRows.map((a) => a[c.metric as NumericMetric])).excluded;
  const chartOption = comparisonChart(rows, c, selected, custom);
  const has =
    c.chart === "grouped" ||
    c.chart === "stacked" ||
    c.chart === "percentStacked"
      ? selectedRows.length > 0
      : chartOption.series?.some((s: any) =>
          s.data?.some((p: any) => {
            const v = p?.value ?? p;
            return Array.isArray(v)
              ? v.some((x) => typeof x === "number" && Number.isFinite(x))
              : typeof v === "number" && Number.isFinite(v);
          }),
        );
  const omitted = rows.length - selectedRows.length;
  const numeric = !["count", "phd", "overseas"].includes(c.metric);
  const composition = ["grouped", "stacked", "percentStacked"].includes(
    c.chart,
  );
  function exportStats() {
    exportStatistics(
      {
        title: `${metricLabels[c.metric]} by ${levelLabels[c.level]}`,
        population: `${selectedRows.length} records (${benchOn ? "Sri Lanka + international benchmark samples" : "Sri Lankan collected profiles"})`,
        filters: {
          universities: filters.universities.join("; "),
          faculties: filters.faculties.join("; "),
          departments: filters.departments.join("; "),
          positions: filters.ranks.join("; "),
          qualifications: filters.qualifications.join("; "),
          "PhD countries": filters.countries.join("; "),
          fields: filters.fields.join("; "),
          "equivalent discipline": benchOn ? discipline : "",
          groups: c.groups.join("; "),
          search: filters.query,
        },
        metric: metricLabels[c.metric],
        metricDefinition: metricDefinitions[c.metric] || "",
        provider: !providerMetric
          ? "not applicable"
          : single
            ? (benchOn ? "OpenAlex" : provider) + " only"
            : "mixed providers (exploratory)",
        aggregation:
          c.level === "type" && c.weight === "equal"
            ? c.aggregation + " (equal university weight)"
            : c.aggregation,
        datasetVersion: d.metadata.version,
        window: d.metadata.window.join("–"),
        minimumSample: minN,
        notes: [
          "Missing values are excluded from denominators, never treated as zero.",
          "Collected profiles are not the total academic population.",
        ],
      },
      groups.map((g) => {
        const q = numeric
          ? quality(g.rows, c.metric as NumericMetric, minN)
          : null;
        return {
          group: g.label,
          value: g.value,
          valid: g.n,
          eligible: g.total,
          providers: q?.providers.map(([p, n]) => `${p} (${n})`).join("; "),
          measured: q?.dates.join("; "),
          flag: g.lowN ? `n < ${minN}: not ranked` : "",
        };
      }),
    );
  }
  async function share() {
    const state = encodeState();
    if (state.length > 40000) {
      setNotice(
        "This comparison is too large to share in a URL. Export the records or reduce the custom groups.",
      );
      return;
    }
    const link =
      location.origin +
      location.pathname +
      "#/compare?view=" +
      encodeURIComponent(state) +
      "&dataset=" +
      encodeURIComponent(d.metadata.version);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Comparison link copied.");
    } catch {
      setNotice("Copy this link: " + link);
    }
  }
  const controls = (
    <aside className="configuration">
      <div className="step-label">01 · Define your comparison</div>
      <label className="field">
        Comparison level
        <Select
          aria-label="Comparison level"
          value={c.level}
          onChange={(e) =>
            configure({ level: e.target.value as Level, groups: [] })
          }
        >
          {Object.entries(levelLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(c.benchmarks)}
          onChange={(e) =>
            configure({ benchmarks: e.target.checked, groups: [] })
          }
        />{" "}
        <span>
          Add international benchmarks
          {c.benchmarks && !benchOn && (
            <small>
              {" "}
              (available at the Public vs Non-state or Universities level)
            </small>
          )}
        </span>
      </label>
      {benchOn && (
        <label className="field">
          Equivalent discipline
          <Select
            aria-label="Equivalent discipline"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as typeof discipline)}
          >
            <option value="all">All sampled disciplines</option>
            {benchmarkFields.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
          </Select>
          <small className="caption">
            Benchmarks cover seven disciplines with uneven university coverage;
            proxy units are excluded. Sri Lankan academics are matched by
            department and faculty. Citation metrics are included only for
            matched research profiles; unresolved values remain blank.
          </small>
        </label>
      )}
      <Multi
        label="Comparison groups"
        options={options.map((g) => ({ value: g.id, label: g.label }))}
        selected={c.groups}
        onChange={(groups) => configure({ groups })}
      />
      <div className="step-label">02 · Choose the measurement</div>
      <label className="field">
        Measurement
        <Select
          aria-label="Measurement"
          value={c.metric}
          onChange={(e) => configure({ metric: e.target.value as Metric })}
        >
          {Object.entries(selectableMetricLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <label className="field">
        Aggregation
        <Select
          aria-label="Aggregation"
          value={c.aggregation}
          onChange={(e) =>
            configure({ aggregation: e.target.value as Aggregation })
          }
        >
          {validModes(c.metric).map((v) => (
            <option key={v} value={v}>
              {
                {
                  median: "Median",
                  mean: "Mean per valid academic",
                  total: "Combined career total",
                  per10: "Per 10 valid academics",
                  distribution: "Individual distribution",
                  percentage: "Percentage of known records",
                }[v]
              }
            </option>
          ))}
        </Select>
      </label>
      {providerMetric && (
        <label className="field">
          Bibliometric provider
          <Select
            aria-label="Bibliometric provider"
            value={single ? (benchOn ? "OpenAlex" : provider) : "mixed"}
            onChange={(e) =>
              e.target.value === "mixed"
                ? configure({ providerMode: "mixed" })
                : configure({
                    providerMode: "single",
                    provider: e.target.value as Provider,
                  })
            }
          >
            {benchOn ? (
              <option value="OpenAlex">
                OpenAlex only (same source as benchmarks)
              </option>
            ) : (
              <>
                {available
                  .filter(([p]) => p !== "OpenAlex")
                  .map(([p, n]) => (
                    <option key={p} value={p}>
                      {p} only ({fmt(n)} values)
                    </option>
                  ))}
                <option value="OpenAlex">
                  OpenAlex only (matched researchers)
                </option>
              </>
            )}
            <option value="mixed">Mixed providers (exploratory)</option>
          </Select>
        </label>
      )}
      {c.level === "type" && (
        <label className="field">
          University weighting
          <Select
            value={c.weight}
            aria-label="University weighting"
            onChange={(e) =>
              configure({ weight: e.target.value as "pooled" | "equal" })
            }
          >
            <option value="pooled">Pooled academics</option>
            <option value="equal">Equal university weight</option>
          </Select>
        </label>
      )}
      <div className="step-label">03 · Visualise</div>
      <label className="field">
        Chart type
        <Select
          aria-label="Chart type"
          value={c.chart}
          onChange={(e) => configure({ chart: e.target.value as ChartType })}
        >
          {Object.entries(charts)
            .filter(
              ([v]) =>
                numeric ||
                !["scatter", "bubble", "box", "histogram"].includes(v),
            )
            .map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
        </Select>
      </label>
      {["scatter", "bubble"].includes(c.chart) && numeric && (
        <label className="field">
          Horizontal axis
          <Select
            aria-label="Horizontal axis"
            value={c.xMetric}
            onChange={(e) =>
              configure({ xMetric: e.target.value as NumericMetric })
            }
          >
            {Object.entries(selectableMetricLabels)
              .filter(([k]) => !["count", "phd", "overseas"].includes(k))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Select>
        </label>
      )}
      <label className="field">
        Order groups
        <Select
          aria-label="Order groups"
          value={c.sort || "name"}
          onChange={(e) =>
            configure({ sort: e.target.value as "name" | "value" })
          }
        >
          <option value="name">Alphabetical</option>
          <option value="value">Statistic, highest first</option>
        </Select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.labels}
          onChange={(e) => configure({ labels: e.target.checked })}
        />
        Show data labels
      </label>
      {numeric && ["bar", "scatter", "bubble"].includes(c.chart) && (
        <label className="check">
          <input
            type="checkbox"
            checked={c.log}
            onChange={(e) => configure({ log: e.target.checked })}
          />
          Logarithmic scale (positive values)
        </label>
      )}
      <details className="comparison-refinements">
        <summary>Refine compared profiles</summary>
        <Filters compact />
      </details>
      <details className="custom-builder" open={c.level === "custom"}>
        <summary>Custom academic groups</summary>
        <p className="caption">
          Save the current pinned selection as a named group. Groups persist in
          this browser and can be shared.
        </p>
        <label className="field">
          Group name
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Computing colleagues"
          />
        </label>
        <Button
          variant="outline"
          disabled={!groupName.trim() || !pinned.length}
          onClick={() => {
            saveGroup({
              id: "custom-" + Date.now(),
              name: groupName.trim(),
              ids: [...pinned],
            });
            setGroupName("");
            configure({ level: "custom", groups: [] });
          }}
        >
          <Plus size={17} />
          Save {pinned.length} pinned academics
        </Button>
        {custom.map((g) => (
          <div className="group-item" key={g.id}>
            <span>
              {g.name} · {g.ids.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={"Delete group " + g.name}
              onClick={() => deleteGroup(g.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </details>
    </aside>
  );
  return (
    <>
      <Header
        eyebrow="Your analytical workspace"
        title="Comparison Studio"
        description="Build a peer group. Explore the distribution. Keep people in perspective."
        action={
          <Button variant="outline" onClick={share}>
            <Share2 size={18} />
            Share comparison
          </Button>
        }
      />
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
      <div
        className="comparison-presets"
        aria-label="Comparison starting points"
      >
        <span className="caption">Start with a question</span>
        {(
          [
            [
              "Compare institution sizes",
              { metric: "count", aggregation: "total", chart: "bar" },
            ],
            [
              "Compare typical citations",
              { metric: "citations", aggregation: "median", chart: "bar" },
            ],
            [
              "Explore individual academics",
              {
                metric: "citations",
                aggregation: "median",
                chart: "scatter",
                xMetric: "hIndex",
              },
            ],
            [
              "Compare academic positions",
              {
                metric: "count",
                aggregation: "total",
                chart: "percentStacked",
              },
            ],
          ] as const
        ).map(([label, settings]) => (
          <Button
            key={label}
            variant="outline"
            onClick={() =>
              configure({
                level: "university",
                groups: [],
                log: false,
                sort: "value",
                labels: true,
                ...settings,
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="studio-toolbar">
        <div className="inline">
          <Button variant="ghost" onClick={() => setLeft(!left)}>
            <PanelLeftClose size={18} />
            {left ? "Hide" : "Show"} controls
          </Button>
          <Button variant="ghost" onClick={() => setRight(!right)}>
            <PanelRightClose size={18} />
            {right ? "Hide" : "Show"} pinned academics
          </Button>
        </div>
        <span>
          {selectedRows.length.toLocaleString()} profiles in comparison
        </span>
      </div>
      <div
        className={
          "studio " + (!left ? "no-left " : "") + (!right ? "no-right" : "")
        }
      >
        {left && !mobile && controls}
        <section
          className="studio-main"
          aria-label="Comparison chart and statistics"
        >
          <div className="chart-title">
            <div className="eyebrow">
              {levelLabels[c.level]} ·{" "}
              {composition ? "Academic composition" : c.aggregation}
            </div>
            <h2>
              {composition
                ? "Qualifications & academic positions"
                : metricLabels[c.metric]}
            </h2>
            <p>
              {groups.length} groups ·{" "}
              {c.level === "type" && c.weight === "equal"
                ? "Equal university weight"
                : "Pooled academics"}{" "}
              · {d.metadata.window.join("–")} recent window
            </p>
          </div>
          {providerMetric &&
            (single ? (
              <div className="inline-note">
                Single provider:{" "}
                <strong>{benchOn ? "OpenAlex" : provider}</strong>.{" "}
                {provided.excluded} values from other providers are treated as
                missing, not zero.
                {(benchOn || provider === "OpenAlex") &&
                  " Sri Lankan OpenAlex values come only from successfully matched researchers; attempted lookups are not matches."}
              </div>
            ) : (
              <div className="notice" role="note">
                Exploratory mode: values from different providers are combined.
                Google Scholar, ResearchGate and OpenAlex report different
                counts, so group differences may reflect the provider rather
                than the academics. Do not use for conclusions.
              </div>
            ))}
          {numeric && (
            <MeasurementNote
              q={quality(selectedRows, c.metric as NumericMetric, minN)}
              metricLabel={metricLabels[c.metric]}
            />
          )}
          {c.chart === "bubble" && (
            <div className="inline-note">
              Bubbles require recorded horizontal, vertical, and h-index values.
              Missing h-index values have no bubble; pinned markers remain
              reference points.
            </div>
          )}
          {c.chart === "heatmap" && (
            <div className="inline-note">
              Colours are normalised separately within each metric column.
              Labels show actual values; no overall score is calculated. h-index
              uses the median when the selected aggregation is total or per 10.
              Equal university weighting also applies to these cells.
            </div>
          )}
          {omitted > 0 && ["faculty", "department"].includes(c.level) && (
            <div className="inline-note">
              {omitted} filtered profiles have no recorded {c.level} and remain
              at their parent level. They are excluded from this level’s groups.
            </div>
          )}
          {c.log && numeric && (
            <div className="inline-note">
              Logarithmic axes show positive values only.{" "}
              {logExcluded
                ? `${logExcluded} zero value${logExcluded === 1 ? " is" : "s are"} left out of the chart (not changed to 1); they remain in the statistics table.`
                : "No zero values are excluded."}
            </div>
          )}
          {composition && (
            <div className="inline-note">
              Composition charts show record counts or percentages by
              rank/qualification, including Unknown, rather than the selected
              research metric.
            </div>
          )}
          {["box", "histogram", "scatter", "bubble"].includes(c.chart) && (
            <div className="inline-note">
              Individual distributions use pooled valid values. University
              weighting applies to aggregate statistics in the table.
            </div>
          )}
          {has && c.chart === "bar" && groups.length > 8 && (
            <p className="muted">
              Eight groups per view · drag the scrollbar to see all{" "}
              {groups.length} groups. Hover or tap a bar for its full name.
            </p>
          )}
          {has ? (
            <Chart
              option={chartOption}
              height={
                c.chart === "heatmap"
                  ? Math.max(480, Math.min(900, groups.length * 48 + 150))
                  : c.chart === "bar"
                    ? Math.max(320, Math.min(8, groups.length) * 64 + 100)
                    : 500
              }
              minWidth={
                c.chart === "heatmap" ? 950 : c.chart === "bar" ? 520 : 680
              }
              onClick={(p) => {
                if (p.data?.academicId)
                  useAtlas.getState().pin(p.data.academicId);
                else if (p.data?.groupId) {
                  const g = groups.find((g) => g.id === p.data.groupId);
                  const a = g?.rows[0];
                  if (a && c.level === "university") {
                    setFilters({
                      universities: [a.universityId],
                      faculties: [],
                      departments: [],
                    });
                    configure({ level: "faculty", groups: [] });
                  } else if (
                    a &&
                    c.level === "faculty" &&
                    g?.rows.some((r) => r.departmentId)
                  ) {
                    setFilters({
                      universities: [a.universityId],
                      faculties: a.facultyId ? [a.facultyId] : [],
                      departments: [],
                    });
                    configure({ level: "department", groups: [] });
                  }
                }
              }}
              label={`${metricLabels[c.metric]} comparison`}
              exportStats={exportStats}
            />
          ) : (
            <Empty>
              {c.level === "custom"
                ? "Create a group from pinned academics to start a comparison."
                : `No valid ${metricLabels[c.metric].toLowerCase()} in these groups. Try another metric.`}
            </Empty>
          )}
          {c.metric === "hIndex" && (
            <p className="inline-note">
              Individual h-index values are never summed or presented as
              institutional h-index.
            </p>
          )}
          {c.aggregation === "total" && numeric && (
            <p className="inline-note">
              Combined career metrics of current listed academics. Publications
              can include work at earlier institutions and repeated coauthored
              papers.
            </p>
          )}
          {c.metric === "phd" && (
            <p className="inline-note">
              Denominator: records with documented qualifications. Unknown
              qualification records are excluded from this percentage and
              counted separately in composition charts.
            </p>
          )}
          {c.metric === "overseas" && (
            <p className="inline-note">
              Denominator: recorded PhD holders with a known
              awarding-institution country. These records are extracted evidence
              and require factual review.
            </p>
          )}
          <div className="section-heading">
            <h3>Supporting statistics</h3>
            <div className="inline">
              <Button variant="ghost" onClick={exportStats}>
                <Download size={17} />
                Export statistics
              </Button>
              <Button variant="ghost" onClick={() => exportCsv(selectedRows)}>
                <Download size={17} />
                Export records
              </Button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Comparison group</th>
                  <th>
                    {metricLabels[c.metric]} ·{" "}
                    {c.aggregation === "distribution"
                      ? "median"
                      : c.aggregation}
                  </th>
                  <th>Valid / records</th>
                  <th>Completeness</th>
                  {numeric && <th>Provider</th>}
                  <th>Flag</th>
                  {c.level === "type" && c.weight === "equal" && (
                    <th>Valid universities</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.label}</td>
                    <td className="numeric">
                      <NumericValue
                        value={g.value}
                        maximum={Math.max(
                          0,
                          ...groups.map((x) => x.value ?? 0),
                        )}
                      />
                    </td>
                    <td>
                      {g.n} / {g.total}
                    </td>
                    <td>
                      <NumericValue
                        value={g.total ? (g.n / g.total) * 100 : null}
                        maximum={100}
                        suffix="%"
                      />
                    </td>
                    {numeric && (
                      <td>
                        {quality(g.rows, c.metric as NumericMetric)
                          .providers.map(([p, n]) => `${p} (${n})`)
                          .join(", ") || "—"}
                      </td>
                    )}
                    <td className={g.lowN ? "flag-cell" : ""}>
                      {g.lowN
                        ? `n < ${minN}: not ranked`
                        : g.total && g.n / g.total < 0.3 && numeric
                          ? "Weak coverage"
                          : ""}
                    </td>
                    {c.level === "type" && c.weight === "equal" && (
                      <td>{g.universityN}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {right && !mobile && <Pinned />}
      </div>
      {mobile && (
        <>
          <Dialog
            open={left}
            onOpenChange={setLeft}
            title="Comparison controls"
          >
            {controls}
          </Dialog>
          <Dialog open={right} onOpenChange={setRight} title="Pinned academics">
            <Pinned />
          </Dialog>
        </>
      )}
      <section className="card supporting">
        <div className="section-heading">
          <h2>Profiles behind this comparison</h2>
        </div>
        <AcademicTable rows={selectedRows} />
      </section>
    </>
  );
}
