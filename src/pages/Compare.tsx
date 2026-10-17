import { NumericValue } from "../components/common";
import { Select } from "../components/ui/select";
import { useState, useEffect } from "react";
import {
  Share2,
  Download,
  PanelRightClose,
  Plus,
  Trash2,
  Stethoscope,
  Cog,
  FlaskConical,
  Cpu,
  Briefcase,
  BookOpen,
  Users,
  Building2,
  TrendingUp,
  Landmark,
  GraduationCap,
  Plane,
  Layers,
  Globe2,
  Award,
  ChartScatter,
  SlidersHorizontal,
} from "lucide-react";
import { useData } from "../data/context";
import { useAtlas, encodeState, emptyFilters } from "../store";
import {
  metricLabels,
  selectableMetricLabels,
  levelLabels,
  levelGroupNouns,
  type Level,
  type Metric,
  type ChartType,
  type Aggregation,
  type NumericMetric,
  type Config,
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
import { Multi } from "../components/Filters";
import { activeFilterCount } from "../components/GlobalFilterButton";
import { Pinned } from "../components/Pinned";
import { AcademicTable } from "../components/AcademicTable";
import { Header, fmt, exportCsv, Empty, colors, personColors, short } from "../components/common";
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
  providerOf,
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
const fieldPresets = [
  { field: "Medicine / Health", icon: Stethoscope, hue: "346" },
  { field: "Engineering", icon: Cog, hue: "28" },
  { field: "Natural Sciences", icon: FlaskConical, hue: "142" },
  { field: "Computing / IT", icon: Cpu, hue: "262" },
  { field: "Management / Business", icon: Briefcase, hue: "215" },
  { field: "Humanities", icon: BookOpen, hue: "18" },
  { field: "Social Sciences", icon: Users, hue: "320" },
];
const questionPresets: {
  label: string;
  hint: string;
  icon: typeof Users;
  hue: string;
  settings: Partial<Config>;
}[] = [
  { label: "How big is each institution?", hint: "Academic records per university", icon: Building2, hue: "232", settings: { metric: "count", aggregation: "total", chart: "bar" } },
  { label: "Who has typical citations?", hint: "Median citations per university", icon: TrendingUp, hue: "262", settings: { metric: "citations", aggregation: "median", chart: "bar" } },
  { label: "Public vs Non-state", hint: "Median citations by sector", icon: Landmark, hue: "232", settings: { level: "type", metric: "citations", aggregation: "median", chart: "bar" } },
  { label: "What is the mix of positions?", hint: "Share of each academic position", icon: Layers, hue: "38", settings: { metric: "count", aggregation: "total", chart: "percentStacked" } },
  { label: "Who holds a PhD?", hint: "Recorded PhD percentage", icon: GraduationCap, hue: "168", settings: { metric: "phd", aggregation: "percentage", chart: "bar" } },
  { label: "Who trained overseas?", hint: "Recorded overseas PhD percentage", icon: Plane, hue: "200", settings: { metric: "overseas", aggregation: "percentage", chart: "bar" } },
  { label: "Where were PhDs earned?", hint: "Academics by PhD country", icon: Globe2, hue: "190", settings: { level: "phdCountry", metric: "count", aggregation: "total", chart: "bar" } },
  { label: "Which disciplines publish most?", hint: "Median publications by discipline", icon: FlaskConical, hue: "142", settings: { level: "field", metric: "publications", aggregation: "median", chart: "bar" } },
  { label: "How does output grow with career stage?", hint: "Median citations by career stage", icon: Award, hue: "28", settings: { level: "careerStage", metric: "citations", aggregation: "median", chart: "bar" } },
  { label: "Explore individual academics", hint: "Citations against h-index", icon: ChartScatter, hue: "320", settings: { metric: "citations", aggregation: "median", chart: "scatter", xMetric: "hIndex" } },
];
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
      setRight(!query.matches && useAtlas.getState().pinned.length > 0);
    };
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  const [right, setRight] = useState(
      () => !window.matchMedia("(max-width:1100px)").matches,
    ),
    [notice, setNotice] = useState(""),
    [groupName, setGroupName] = useState("");
  const [inspectedGroup, setInspectedGroup] = useState<string | null>(null);
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
                  university: `${a.universityShort} | ${a.country} (${a.tier})`,
                  type: `International | ${tierLabels[a.tier]}`,
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
  const excludedMetricValues = providerMetric && single
    ? filtered.filter((a, i) => a[c.metric as NumericMetric] !== null && provided.rows[i][c.metric as NumericMetric] === null).length
    : 0;
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
    options = groupRows(rows, c.level, custom).sort((x, y) =>
      x.label.localeCompare(y.label),
    );
  const noun = levelGroupNouns[c.level].replace(/^(?!PhD)(.)/, (m) => m.toLowerCase());
  const selectedRows = [
    ...new Map(groups.flatMap((g) => g.rows).map((a) => [a.id, a])).values(),
  ];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const logExcluded = ["count", "phd", "overseas"].includes(c.metric)
    ? 0
    : logSplit(selectedRows.map((a) => a[c.metric as NumericMetric])).excluded;
  // People whose value comes from another provider are still shown, marked with
  // that provider, but are never ranked against the selected provider's peers.
  const otherProvider = new Map<string, string>();
  const referenceRows = single
    ? withProvider(selected, provider, openAlex || undefined).rows.map((r, i) => {
        const raw = selected[i];
        const m = c.metric as NumericMetric;
        if (!["count", "phd", "overseas"].includes(c.metric) && r[m] === null && raw?.[m] != null) {
          const p = providerOf(raw, m);
          otherProvider.set(r.id, p === "Not recorded" ? "other provider" : p);
          return raw;
        }
        return r;
      })
    : selected;
  const chartOption = comparisonChart(rows, c, referenceRows, custom, otherProvider);
  const inspected = groups.find((g) => g.id === inspectedGroup);
  const missingReferenceValues = referenceRows.filter((a) =>
    !["count", "phd", "overseas"].includes(c.metric) && a[c.metric as NumericMetric] === null,
  );
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
    <section className="comparison-setup" aria-label="Comparison setup">
      <div className="comparison-setup-heading">
        <h2>Build your comparison</h2>
        <span className="caption">Choose your groups, measurement and chart.</span>
      </div>
      <div className="comparison-primary-controls">
      <label className="field">
        Comparison level
        <Select
          aria-label="Comparison level"
          value={c.level}
          onChange={(e) =>
            configure({ level: e.target.value as Level, groups: [] })
          }
        >
          {Object.entries(levelLabels).filter(([v]) => v !== "department" && v !== "experience").map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <div className="field group-picker-field"><span>{levelGroupNouns[c.level]}</span>
      <Multi
        label={`Choose ${noun}`}
        noun={noun}
        options={options.map((g) => ({ value: g.id, label: g.label }))}
        selected={c.groups}
        onChange={(groups) => configure({ groups })}
      />
      </div>
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
      </div>
      <details className="comparison-options">
        <summary>More options
          {c.benchmarks && <span className="pill">International benchmarks enabled</span>}
        </summary>
        <div className="comparison-options-grid">
          <section><h3>Scope & benchmarks</h3>
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
          </section>
          <section><h3>Chart display</h3>
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
          </section>
        </div>
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
              {g.name} | {g.ids.length}
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
      </details>
    </section>
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
      <section className="quickstart" aria-label="Comparison starting points">
        <div className="quickstart-group">
          <h3>Compare faculties in a field</h3>
          <p className="caption">Picks every faculty in that field across universities. Change the faculties in the picker below.</p>
          <div className="quick-tiles field-tiles">
            {fieldPresets.map(({ field, icon: Icon, hue }) => (
              <button
                key={field}
                type="button"
                className="quick-tile"
                style={{ "--hue": hue } as React.CSSProperties}
                onClick={() => {
                  setFilters({ ...emptyFilters(), fields: [field] });
                  configure({ level: "faculty", groups: [], metric: "citations", aggregation: "median", chart: "bar", log: false, sort: "value", labels: true });
                }}
              >
                <span className="quick-icon"><Icon size={18} aria-hidden="true" /></span>
                <span>{field}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="quickstart-group">
          <h3>Or start with a question</h3>
          <div className="quick-tiles">
            {questionPresets.map(({ label, hint, icon: Icon, hue, settings }) => (
              <button
                key={label}
                type="button"
                className="quick-tile question"
                style={{ "--hue": hue } as React.CSSProperties}
                onClick={() =>
                  configure({ level: "university", groups: [], log: false, sort: "value", labels: true, ...settings })
                }
              >
                <span className="quick-icon"><Icon size={18} aria-hidden="true" /></span>
                <span><b>{label}</b><small>{hint}</small></span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="studio-toolbar">
        <div className="inline">
          <Button variant="ghost" onClick={() => setRight(!right)}>
            <PanelRightClose size={18} />
            {right ? "Hide people" : "Add people"} {pinned.length > 0 && `(${pinned.length})`}
          </Button>
        </div>
        <span className="toolbar-counts">
          {activeFilterCount(filters) > 0 && (
            <button type="button" className="filter-chip" onClick={() => setFilters(emptyFilters())} title="Clear the dataset filters set from the Filters button">
              <SlidersHorizontal size={14} aria-hidden="true" /> {activeFilterCount(filters)} filter{activeFilterCount(filters) > 1 ? "s" : ""} on | Clear
            </button>
          )}
          {selectedRows.length.toLocaleString()} profiles in comparison
        </span>
      </div>
      {controls}
      <div className={"studio comparison-workspace " + (!right || mobile ? "no-right" : "")}>
        <section
          className="studio-main"
          aria-label="Comparison chart and statistics"
        >
          <div className="chart-title">
            <div className="eyebrow">
              {levelLabels[c.level]} |{" "}
              {composition ? "Academic composition" : c.aggregation}
            </div>
            <h2>
              {composition
                ? "Qualifications & academic positions"
                : metricLabels[c.metric]}
            </h2>
            <p>
              {groups.length} groups |{" "}
              {c.level === "type" && c.weight === "equal"
                ? "Equal university weight"
                : "Pooled academics"}{" "}
              | {(c.metric === "recentCitations"
                ? `${d.metadata.window.join("–")} window`
                : numeric ? "All-time recorded values" : "Collected profiles")}
            </p>
          </div>
          {providerMetric &&
            (single ? null : (
              <div className="notice" role="note">
                Exploratory mode: values from different providers are combined.
                Google Scholar, ResearchGate and OpenAlex report different
                counts, so group differences may reflect the provider rather
                than the academics. Do not use for conclusions.
              </div>
            ))}
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
          {c.log && numeric && (
            <div className="inline-note">
              Logarithmic axes show positive values only.{" "}
              {logExcluded
                ? `${logExcluded} zero value${logExcluded === 1 ? " is" : "s are"} left out of the chart (not changed to 1); they remain in the statistics table.`
                : "No zero values are excluded."}
            </div>
          )}
          {["box", "histogram", "scatter", "bubble"].includes(c.chart) && (
            <div className="inline-note">
              Individual distributions use pooled valid values. University
              weighting applies to aggregate statistics in the table.
            </div>
          )}
          {numeric && referenceRows.length > 0 && (
            <div className="pinned-reference-key" aria-label="Pinned plot references">
              <p className="caption">
                {c.chart === "bar" && ["median", "mean", "distribution"].includes(c.aggregation)
                  ? "Dashed lines show individual values. Numbers match the people below."
                  : "Pinned individual values"}
              </p>
              <div className="reference-chips">
                {referenceRows.map((a, i) => (
                  <span key={a.id} className="reference-chip" style={{ borderColor: personColors[i % personColors.length] }}>
                    <b style={{ color: personColors[i % personColors.length] }}>{i + 1}</b>
                    <span>{a.name}</span>
                    <strong>{fmt(a[c.metric as NumericMetric], 1)}</strong>
                    {otherProvider.has(a.id) && <em className="reference-source">{otherProvider.get(a.id)}</em>}
                  </span>
                ))}
              </div>
              {missingReferenceValues.length > 0 && <p className="caption">No recorded value, not plotted: {missingReferenceValues.map((a) => a.name).join(", ")}.</p>}
            </div>
          )}
          {has && !composition && (() => {
            const ranked = groups.filter((g) => g.value !== null && !g.lowN);
            if (ranked.length < 2) return null;
            const top = ranked.reduce((m, g) => (g.value! > m.value! ? g : m));
            const bottom = ranked.reduce((m, g) => (g.value! < m.value! ? g : m));
            const pctMetric = ["phd", "overseas"].includes(c.metric);
            const agg = c.aggregation === "total" ? "Total" : c.aggregation === "mean" ? "Mean" : "Median";
            const sub = (g: typeof top) =>
              c.metric === "count"
                ? `${fmt(g.value, 0)} profiles`
                : `${pctMetric ? "" : agg + " "}${fmt(g.value, pctMetric ? 1 : 0)}${pctMetric ? "%" : ""} | ${fmt(g.n)} profiles`;
            const ratio = top.value! > 0 && bottom.value! > 0;
            const excluded = groups.length - ranked.length;
            return (
              <div className="compare-highlights" aria-label="Headline results">
                <div className="highlight top"><small>Highest</small><strong>{short(top.label)}</strong><span>{sub(top)}</span></div>
                <div className="highlight low"><small>Lowest</small><strong>{short(bottom.label)}</strong><span>{sub(bottom)}</span></div>
                <div className="highlight">
                  <small>Gap</small>
                  <strong>{ratio ? `${fmt(top.value! / bottom.value!, 1)}×` : fmt(top.value! - bottom.value!, 1)}</strong>
                  <span>
                    {ranked.length} groups
                    {excluded > 0 ? ` | ${excluded} too small to rank` : ""}
                  </span>
                </div>
              </div>
            );
          })()}
          <details className="data-notes">
            <summary>About these figures</summary>
            <div>
              {providerMetric && single && (
                <p>Single provider: <strong>{benchOn ? "OpenAlex" : provider}</strong>. {excludedMetricValues} values from other providers are treated as missing, not zero.</p>
              )}
              {numeric && (
                <p>{metricLabels[c.metric]}: {fmt(quality(selectedRows, c.metric as NumericMetric, minN).valid)} valid of {fmt(selectedRows.length)} eligible records.</p>
              )}
              {omitted > 0 && ["faculty", "department"].includes(c.level) && (
                <p>{omitted} filtered profiles have no recorded {c.level} and remain at their parent level.</p>
              )}
              {composition && <p>Composition charts show record counts or percentages by position or qualification, including Unknown, rather than the selected research metric.</p>}
              <p>Groups with fewer than {minN} valid values are shown for reference and are not ranked.</p>
            </div>
          </details>
          {has ? (
            <Chart
              option={chartOption}
              height={
                c.chart === "heatmap"
                  ? Math.max(480, Math.min(900, groups.length * 48 + 150))
                  : composition
                    ? 580
                    : c.chart === "bar"
                    ? Math.max(300, Math.min(14, groups.filter((g) => g.value !== null).length) * 46 + 110)
                    : 500
              }
              minWidth={
                c.chart === "heatmap" ? 950 : c.chart === "bar" ? 520 : 680
              }
              onClick={(p) => {
                if (p.data?.academicId)
                  useAtlas.getState().pin(p.data.academicId);
                else if (p.data?.groupId) setInspectedGroup(p.data.groupId);
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
                    {metricLabels[c.metric]} |{" "}
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
        {right && !mobile && <Pinned comparisonRows={selectedRows} referenceAcademics={referenceRows} otherProvider={otherProvider} providerLabel={single ? provider : undefined} />}
      </div>
      {mobile && (
        <>
          <Dialog open={right} onOpenChange={setRight} title="Pinned academics">
            <Pinned showHeading={false} comparisonRows={selectedRows} referenceAcademics={referenceRows} otherProvider={otherProvider} providerLabel={single ? provider : undefined} />
          </Dialog>
        </>
      )}
      <Dialog open={Boolean(inspected)} onOpenChange={(open) => { if (!open) setInspectedGroup(null); }} title={inspected?.label || "Group details"} className="group-details-dialog">
        {inspected && <>
          <div className="group-details-summary">
            <div><span>{metricLabels[c.metric]} | {composition ? "Composition" : c.aggregation}</span><strong>{composition ? fmt(inspected.total) : fmt(inspected.value, 1)}</strong></div>
            <div><span>Profiles with a usable value</span><strong>{inspected.n} / {inspected.total}</strong></div>
            <div><span>Coverage</span><strong>{inspected.total ? fmt(100 * inspected.n / inspected.total, 1) + "%" : "Not available"}</strong></div>
          </div>
          {numeric && <MeasurementNote q={quality(inspected.rows, c.metric as NumericMetric, minN)} metricLabel={metricLabels[c.metric]} />}
          {inspected.lowN && <p className="inline-note">Insufficient sample: this group is shown for reference and is not ranked.</p>}
          <div className="section-heading"><h3>Contributing profiles</h3>
            {["university", "faculty"].includes(c.level) && <Button variant="outline" onClick={() => {
              const a = inspected.rows[0];
              if (!a) return;
              setFilters({ universities: [a.universityId], faculties: c.level === "faculty" && a.facultyId ? [a.facultyId] : [], departments: [] });
              configure({ level: c.level === "university" ? "faculty" : "department", groups: [] });
              setInspectedGroup(null);
            }}>Explore this group</Button>}
          </div>
          <AcademicTable key={inspected.id + c.metric} rows={inspected.rows} sortMetric={numeric ? c.metric : undefined} />
        </>}
      </Dialog>
      <section className="card supporting">
        <div className="section-heading">
          <h2>Profiles behind this comparison</h2>
        </div>
        <AcademicTable rows={selectedRows} />
      </section>
    </>
  );
}
