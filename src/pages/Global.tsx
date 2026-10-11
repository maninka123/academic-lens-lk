import { NumericValue } from "../components/common";
import { Select } from "../components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import {
  benchmarkFields,
  defaultBenchmarkFields,
  type BenchmarkField,
  loadBenchmarks,
  matchedField,
  qsNumeric,
  tierLabels,
  type Benchmarks,
  type Tier,
} from "../data/international";
import { summary, median } from "../analytics/engine";
import {
  careerStageOf,
  isMatched,
  logSplit,
  MIN_SAMPLE,
  WEAK_COVERAGE,
} from "../analytics/quality";
import { exportStatistics, metricDefinitions } from "../analytics/exports";
import { Header, Card, Stat, Empty, fmt } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import type { Academic } from "../types";

type GMetric = "hIndex" | "citations" | "recentCitations" | "publications";
const metricNames: Record<GMetric, string> = {
  hIndex: "h-index",
  citations: "Total citations",
  recentCitations: "Citations received 2021–2025",
  publications: "Publications",
};
const TIERS: Tier[] = ["elite", "middle", "lower"];
const tierShort: Record<Tier, string> = {
  elite: "Elite tier",
  middle: "Middle tier",
  lower: "Lower tier",
};
const COUNTRIES = [
  "United States",
  "Australia",
  "China",
  "India",
  "Canada",
  "France",
  "Germany",
];
const STAGES = ["Professor", "Mid-career", "Early-career"] as const;
// Ordinal one-hue ramp for tiers (validated) + an accent for Sri Lanka.
const palette = {
  light: {
    elite: "#104281",
    middle: "#3987e5",
    lower: "#86b6ef",
    sl: "#eb6834",
  },
  dark: {
    elite: "#9ec5f4",
    middle: "#5598e7",
    lower: "#1c5cab",
    sl: "#d95926",
  },
};
type Group = {
  key: Tier | "sl";
  label: string;
  /** Records eligible for the comparison (after discipline/stage filters). */
  eligible: number;
  /** Values of the metric from the comparison provider. */
  values: number[];
  /** Values that can be drawn on the current axis (log: positive only). */
  plotted: number[];
  zeros: number;
};
type Unit = Group & { id: string; country: string; qs: string; attempted?: number };

export { isMatched };

export function Global() {
  const d = useData();
  const theme = useAtlas((s) => s.theme);
  const col = palette[theme];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const [b, setB] = useState<Benchmarks | null>(null),
    [error, setError] = useState(""),
    [metric, setMetric] = useState<GMetric>("hIndex"),
    [field, setField] = useState<"matched" | BenchmarkField>(
      "matched",
    ),
    [stage, setStage] = useState<"all" | (typeof STAGES)[number]>("all"),
    [mode, setMode] = useState<"likeForLike" | "exploratory">("likeForLike"),
    [includeProxy, setIncludeProxy] = useState(false),
    [log, setLog] = useState(true),
    [showAllUniversities, setShowAllUniversities] = useState(false);
  useEffect(() => {
    loadBenchmarks().then(setB, (e) => setError(String(e)));
  }, []);

  const view = useMemo(() => {
    if (!b) return null;
    const fieldOk = (f: string) => field === "matched" ? defaultBenchmarkFields.includes(f) : f === field;
    const stageOk = (rank: string) =>
      stage === "all" || careerStageOf(rank) === stage;
    const intl = b.academics.filter(
      (a) =>
        fieldOk(a.field) &&
        stageOk(a.rank) &&
        (includeProxy || a.unitType !== "proxy"),
    );
    const sl = d.academics.filter((a) => {
      const f = matchedField(a);
      return f !== "" && fieldOk(f) && stageOk(a.rank);
    });
    // Sri Lankan value from the comparison provider. Like-for-like uses only
    // successfully matched OpenAlex researchers; attempted lookups are not matches.
    const slValue = (a: Academic) => {
      if (mode === "exploratory") return a[metric];
      const o = b.slOpenAlex.get(a.id);
      return o && isMatched(o.status) ? (o[metric] ?? null) : null;
    };
    const build = (
      key: Tier | "sl",
      label: string,
      raw: (number | null)[],
      eligible: number,
    ): Group => {
      const vals = raw.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v),
      );
      const split = logSplit(vals);
      return {
        key,
        label,
        eligible,
        values: vals,
        plotted: log ? split.positive : vals,
        zeros: split.excluded,
      };
    };
    const slMatched = sl.filter((a) =>
      isMatched(b.slOpenAlex.get(a.id)?.status),
    );
    const tierGroups: Group[] = [
      build("sl", "Sri Lanka", sl.map(slValue), sl.length),
      ...[...TIERS].reverse().map((t) => {
        const rows = intl.filter((a) => a.tier === t);
        return build(
          t,
          tierLabels[t],
          rows.map((a) => a[metric]),
          rows.length,
        );
      }),
    ];
    const units: Unit[] = [
      ...b.universities.map((u) => {
        const rows = intl.filter((a) => a.universityId === u.id);
        return {
          ...build(
            u.tier,
            u.name,
            rows.map((a) => a[metric]),
            rows.length,
          ),
          id: u.id,
          country: u.country,
          qs: u.qsRank,
        };
      }),
      ...d.universities.map((u) => {
        const rows = sl.filter((a) => a.universityId === u.id);
        return {
          ...build("sl", u.name, rows.map(slValue), rows.length),
          id: u.id,
          country: "Sri Lanka",
          qs: b.metadata.sriLankaQs[u.id] || "not ranked",
          attempted: rows.filter(a => b.slOpenAlex.has(a.id)).length,
        };
      }),
    ];
    const proxies = b.academics.filter(
      (a) => a.unitType === "proxy" && fieldOk(a.field),
    );
    const labs = intl.filter((a) => a.unitType === "research-lab").length;
    const attempted = sl.filter((a) => b.slOpenAlex.has(a.id)).length;
    return { intl, sl, slMatched, attempted, tierGroups, units, proxies, labs };
  }, [b, d, metric, field, stage, mode, includeProxy, log]);

  if (error)
    return (
      <Empty title="International benchmarks are unavailable">{error}</Empty>
    );
  if (!b || !view)
    return (
      <div className="loading" aria-live="polite">
        <div className="skeleton" style={{ height: 180 }} />
        <p>Loading international benchmarks…</p>
      </div>
    );

  const colorOf = (t: Tier | "sl") => (t === "sl" ? col.sl : col[t]);
  const enough = (g: Group) => g.values.length >= minN;
  const medianOf = (g: Group) => (enough(g) ? median(g.values) : null);
  const sl = view.tierGroups[0];
  const slMedian = medianOf(sl);
  const provider =
    mode === "likeForLike"
      ? "OpenAlex on both sides"
      : "Sri Lanka: collected Google Scholar/ResearchGate; benchmarks: OpenAlex (exploratory)";
  const coverage = (g: Group) =>
    g.eligible ? (100 * g.values.length) / g.eligible : null;
  const weak = (g: Group) => {
    const c = coverage(g);
    return c !== null && c < WEAK_COVERAGE;
  };
  const describe = (g: Group) =>
    `${g.values.length} valid of ${g.eligible} eligible` +
    (weak(g) ? ` · weak coverage (${fmt(coverage(g), 1)}%)` : "");
  const zeroCount = view.tierGroups.reduce((s, g) => s + g.zeros, 0);

  // 1 · Box plot: Sri Lanka vs each tier (insufficient groups are not drawn).
  const box = {
    tooltip: { trigger: "item", confine: true },
    grid: { left: 70, right: 30, top: 30, bottom: 60, containLabel: true },
    xAxis: {
      type: "category",
      data: view.tierGroups.map(
        (g) =>
          `${g.key === "sl" ? "Sri Lanka" : tierShort[g.key as Tier].replace(" tier", "")}\nn=${g.values.length}${enough(g) ? "" : " ⚠"}`,
      ),
      axisLabel: { fontSize: 12, interval: 0 },
    },
    yAxis: {
      type: log ? "log" : "value",
      name: metricNames[metric],
      nameLocation: "middle",
      nameGap: 50,
      min: log ? undefined : 0,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: [
      {
        type: "boxplot",
        name: metricNames[metric],
        data: view.tierGroups.map((g) => {
          const s = summary(g.plotted);
          return enough(g) && s.n
            ? {
                value: [s.min, s.q1, s.median, s.q3, s.max],
                itemStyle: {
                  color: colorOf(g.key) + "33",
                  borderColor: colorOf(g.key),
                  borderWidth: 2,
                },
              }
            : { value: [null, null, null, null, null] };
        }),
        tooltip: {
          formatter: (p: any) => {
            const g = view.tierGroups[p.dataIndex];
            if (!enough(g))
              return `${g.label}<br/>Insufficient sample: ${describe(g)} (minimum ${minN})`;
            const s = summary(g.values);
            return `${g.label}<br/>Median ${fmt(s.median, 1)} · IQR ${fmt(s.q1, 1)}–${fmt(s.q3, 1)}<br/>${describe(g)}${log && g.zeros ? `<br/>${g.zeros} zero values not drawn` : ""}`;
          },
        },
      },
    ],
  };

  // 2 · Country × tier medians with the Sri Lanka median as a reference line.
  const byCountry = {
    tooltip: { trigger: "item", confine: true },
    legend: { show: false },
    grid: { left: 45, right: 15, top: 20, bottom: 15, containLabel: true },
    xAxis: {
      type: "category",
      data: COUNTRIES,
      axisLabel: {
        fontSize: 14,
        interval: 0,
        formatter: (country: string) =>
          ({
            "United States": "USA",
            Australia: "Australia",
            Germany: "Germany",
          })[country] || country,
      },
    },
    yAxis: {
      type: "value",
      name: `Median ${metricNames[metric]}`,
      nameLocation: "middle",
      nameGap: 50,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: TIERS.map((t, i) => ({
      type: "bar",
      name: tierShort[t],
      barGap: "8%",
      barMaxWidth: 26,
      itemStyle: { color: col[t], borderRadius: [4, 4, 0, 0] },
      data: COUNTRIES.map((c) => {
        const rows = view.intl.filter((a) => a.country === c && a.tier === t);
        const vals = rows
          .map((a) => a[metric])
          .filter((v): v is number => v !== null);
        return {
          value: vals.length >= minN ? median(vals) : null,
          n: vals.length,
          eligible: rows.length,
        };
      }),
      tooltip: {
        formatter: (p: any) =>
          p.data.n >= minN
            ? `${p.name} · ${tierShort[t]}<br/>Median ${fmt(p.value, 1)} (${p.data.n} valid of ${p.data.eligible})`
            : `${p.name} · ${tierShort[t]}<br/>Insufficient sample (${p.data.n} valid; minimum ${minN})`,
      },
      ...(i === 0 && slMedian !== null
        ? {
            markLine: {
              symbol: "none",
              lineStyle: { color: col.sl, type: "dashed", width: 2 },
              label: { show: false },
              tooltip: { formatter: `Sri Lanka median ${fmt(slMedian, 1)}` },
              data: [{ yAxis: slMedian }],
            },
          }
        : {}),
    })),
  };

  // 3 · University ladder (median), only universities with an adequate sample.
  const allLadderUnits = view.units
    .filter((u) => enough(u) && median(u.values) !== null && (!log || median(u.values)! > 0))
    .map((u) => ({ ...u, med: median(u.values)! }))
    .sort((a, b) => b.med - a.med);
  const ladderUnits = showAllUniversities
    ? allLadderUnits
    : allLadderUnits.filter((u, i) => i < 12 || u.key === "sl");
  const hiddenSl = view.units.filter(
    (u) => u.key === "sl" && u.eligible > 0 && !enough(u),
  );
  const ladder = {
    tooltip: { trigger: "item", confine: true },
    grid: { left: 10, right: 50, top: 10, bottom: 30, containLabel: true },
    xAxis: {
      type: log ? "log" : "value",
      min: log ? undefined : 0,
      name: `Median ${metricNames[metric]}`,
      nameLocation: "middle",
      nameGap: 28,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: ladderUnits.map((u) => u.label),
      axisLabel: { fontSize: 14, width: 230, overflow: "break", lineHeight: 18 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 16,
        label: {
          show: true,
          position: "right",
          formatter: (p: any) => Number(p.value).toFixed(1),
        },
        data: ladderUnits.map((u) => ({
          value: u.med,
          itemStyle: { color: colorOf(u.key), borderRadius: [0, 4, 4, 0] },
          unit: u,
        })),
        tooltip: {
          formatter: (p: any) => {
            const u: Unit = p.data.unit;
            return `${u.label} (${u.country})<br/>${u.key === "sl" ? "Sri Lanka" : tierLabels[u.key as Tier]} · QS 2027 ${u.qs}<br/>Median ${fmt(median(u.values), 1)} · ${describe(u)}`;
          },
        },
      },
    ],
  };

  // 4 · QS position vs median metric.
  const scatterUnits = allLadderUnits.filter((u) => qsNumeric(u.qs) !== null);
  const scatter = {
    tooltip: { trigger: "item", confine: true },
    legend: { show: false },
    grid: { left: 60, right: 30, top: 25, bottom: 55, containLabel: true },
    xAxis: {
      type: "log",
      name: "QS 2027 rank (log scale)",
      nameLocation: "middle",
      nameGap: 32,
      inverse: true,
      min: 1,
      max: 2000,
      axisLabel: { formatter: (v: number) => String(Math.round(v)) },
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    yAxis: {
      type: log ? "log" : "value",
      min: log ? Math.pow(10, Math.floor(Math.log10(Math.min(...scatterUnits.map(u => u.med), ...(slMedian !== null && slMedian > 0 ? [slMedian] : []))))) : 0,
      name: `Median ${metricNames[metric]}`,
      nameLocation: "middle",
      nameGap: 50,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: (["elite", "middle", "lower", "sl"] as const).map((t) => ({
      type: "scatter",
      name: t === "sl" ? "Sri Lanka" : tierShort[t],
      markLine: t === "sl" && slMedian !== null && (!log || slMedian > 0) ? { silent: true, symbol: "none", lineStyle: { color: col.sl, type: "dashed", width: 2 }, label: { show: false }, data: [{ yAxis: slMedian }] } : undefined,
      symbolSize: t === "sl" ? 14 : 11,
      itemStyle: {
        color: colorOf(t),
        borderColor: theme === "dark" ? "#1a1a19" : "#fcfcfb",
        borderWidth: 2,
      },
      label: {
        show: t === "sl",
        formatter: (p: any) => p.data.unit.label,
        position: "right",
        color: "inherit",
      },
      data: scatterUnits
        .filter((u) => u.key === t)
        .map((u) => ({ value: [qsNumeric(u.qs), u.med], unit: u })),
      tooltip: {
        formatter: (p: any) => {
          const u: Unit = p.data.unit;
          return `${u.label} (${u.country})<br/>QS 2027 ${u.qs}<br/>Median ${fmt(median(u.values), 1)} · ${describe(u)}`;
        },
      },
    })),
  };

  const tableRows = [...view.units]
    .filter((u) => u.eligible > 0)
    .sort(
      (a, b) =>
        (qsNumeric(a.qs) ?? 9999) - (qsNumeric(b.qs) ?? 9999) ||
        a.label.localeCompare(b.label),
    );
  const exportTable = () =>
    exportStatistics(
      {
        title: `Global benchmarks · ${metricNames[metric]}`,
        population:
          "Sri Lankan collected profiles in matched disciplines and international QS-tier samples (seven covered disciplines)",
        filters: {
          discipline:
            field === "matched" ? "Computer Science & Physics" : field,
          "career stage": stage,
          "proxy units": includeProxy ? "included" : "excluded",
        },
        metric: metricNames[metric],
        metricDefinition: metricDefinitions[metric],
        provider,
        aggregation:
          "median per university (groups below the minimum are not reported)",
        datasetVersion: d.metadata.version,
        window: d.metadata.window.join("–"),
        minimumSample: minN,
        notes: [
          "International samples are not national censuses.",
          "Sri Lankan QS positions use the midpoint of the published band.",
        ],
      },
      tableRows.map((u) => ({
        group: `${u.label} (${u.country}, ${u.key === "sl" ? "Sri Lanka" : u.key}, QS ${u.qs})`,
        value: medianOf(u),
        valid: u.values.length,
        eligible: u.eligible,
        providers:
          u.key === "sl" && mode === "exploratory"
            ? "Google Scholar/ResearchGate"
            : "OpenAlex",
        flag: !enough(u)
          ? `n < ${minN}: not reported`
          : weak(u)
            ? "Weak coverage"
            : "",
      })),
      "global-benchmarks.csv",
    );

  const statFor = (g: Group) => {
    const m = medianOf(g);
    return (
      <Stat
        key={g.key}
        label={g.key === "sl" ? "Sri Lanka" : tierShort[g.key as Tier]}
        value={m === null ? "—" : m.toFixed(1)}
        detail={`${g.values.length} valid profiles${m === null ? " · insufficient data" : " · median " + metricNames[metric]}`}
      />
    );
  };

  return (
    <>
      <Header
        eyebrow="Sri Lanka · International benchmarks"
        title="Global benchmarks"
        description={`${b.universities.length} universities · 7 countries · QS 2027 tiers`}
        action={
          <Button variant="ghost" onClick={exportTable}>
            Export statistics CSV
          </Button>
        }
      />
      {mode === "likeForLike" ? (
        <div className="benchmark-method-note" role="note">
          <span>
            OpenAlex on both sides · {view.slMatched.length} Sri Lankan matches
            · Minimum {minN} valid profiles per group
          </span>
          <a
            href="https://github.com/maninka123/academic-lens-lk#global-benchmark-method"
            target="_blank"
            rel="noreferrer"
          >
            Method & sources ↗
          </a>
        </div>
      ) : (
        <div className="notice warn-notice" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> Exploratory
          mixed-provider mode: Sri Lankan values are collected Google
          Scholar/ResearchGate snapshots, benchmarks are OpenAlex. Scholar
          usually reports higher counts, so this view is not a valid comparison
          and must not be used for conclusions.
        </div>
      )}
      <div className="global-controls">
        <label className="field">
          Comparison
          <Select
            aria-label="Comparison provider"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="likeForLike">
              Like-for-like (OpenAlex both sides)
            </option>
            <option value="exploratory">Exploratory: mixed providers</option>
          </Select>
        </label>
        <label className="field">
          Metric
          <Select
            aria-label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as GMetric)}
          >
            {Object.entries(metricNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          Equivalent discipline
          <Select
            aria-label="Equivalent discipline"
            value={field}
            onChange={(e) => setField(e.target.value as typeof field)}
          >
            <option value="matched">Computer Science & Physics</option>
            {benchmarkFields.map((discipline) => (
              <option key={discipline} value={discipline}>{discipline}</option>
            ))}
          </Select>
        </label>
        <label className="field">
          Career stage
          <Select
            aria-label="Career stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as typeof stage)}
          >
            <option value="all">All positions</option>
            <option value="Professor">Professors</option>
            <option value="Mid-career">
              Associate professors / senior lecturers
            </option>
            <option value="Early-career">
              Assistant professors / lecturers
            </option>
          </Select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeProxy}
            onChange={(e) => setIncludeProxy(e.target.checked)}
          />{" "}
          Include proxy units ({view.proxies.length})
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={log}
            onChange={(e) => setLog(e.target.checked)}
          />{" "}
          Log scale
        </label>
      </div>
      {(includeProxy || log) && (
        <p className="chart-note">
          {includeProxy ? "Proxy disciplines included · " : ""}
          {log
            ? `Log scale: ${zeroCount} zero values remain in summaries but are not plotted.`
            : ""}
        </p>
      )}
      <div className="stats-grid">{view.tierGroups.map(statFor)}</div>
      <div className="benchmark-key">
        {(["sl", "elite", "middle", "lower"] as const).map((key) => (
          <span key={key}>
            <i style={{ background: col[key] }} />
            {key === "sl" ? "Sri Lanka" : tierShort[key]}
          </span>
        ))}
      </div>
      <div className="two-columns">
        <Card
          title="Sri Lanka against each tier"
          subtitle="Box: middle 50% · Line: median · Whiskers: observed range"
        >
          <Chart
            option={box}
            height={320}
            label="Box plot of the metric for Sri Lanka and the three international tiers"
            exportStats={exportTable}
          />
        </Card>
        <Card
          title="Tier medians by country"
          subtitle={
            slMedian === null
              ? `Sri Lankan median not shown: only ${sl.values.length} valid values (minimum ${minN}).`
              : `Orange dashed line: Sri Lankan median (${fmt(slMedian, 1)}) for the same selection.`
          }
        >
          <Chart
            option={byCountry}
            height={320}
            label="Grouped bar chart of tier medians by country with a Sri Lanka reference line"
          />
        </Card>
      </div>
      <Card
        title="Where universities sit"
        subtitle={`At least ${minN} valid profiles · Sri Lanka highlighted in orange`}
        action={
          <Button
            variant="ghost"
            onClick={() => setShowAllUniversities(!showAllUniversities)}
          >
            {showAllUniversities
              ? "Show highlights"
              : `Show all (${allLadderUnits.length})`}
          </Button>
        }
      >
        {hiddenSl.length > 0 && (
          <details className="benchmark-missing">
            <summary>{hiddenSl.length} Sri Lankan universities need more usable metric values</summary>
            <p>Each median needs {minN} valid values for the selected filters and provider. Missing values are not zero.</p>
            <ul>{hiddenSl.map(u => <li key={u.id}><strong>{u.label}</strong><span>{mode === "likeForLike" && u.attempted === 0 ? `OpenAlex lookup pending · ${u.eligible} matching profiles` : `${u.values.length} usable values / ${u.eligible} matching profiles`}</span></li>)}</ul>
          </details>
        )}
        <div className="benchmark-ladder-window">
          <Chart
            option={ladder}
            height={Math.max(300, ladderUnits.length * 48 + 65)}
            label="Ranked bar chart of university medians"
            exportStats={exportTable}
          />
        </div>
      </Card>
      <Card
        title="QS position and research metric"
        subtitle="Better QS rank → · Each dot is a university median"
      >
        <div className="benchmark-reference"><span className="reference-dot" />
          <strong>Sri Lanka</strong><span>{slMedian !== null ? `Median ${fmt(slMedian, 1)} · ${sl.values.length} valid records` : `Insufficient sample: ${sl.values.length} valid records`}</span>
          <small>Pooled sample · dashed line; dots require a QS rank and {minN}+ valid records.</small>
        </div>
        <Chart
          option={scatter}
          height={430}
          label="Scatter of QS 2027 position against university median"
        />
      </Card>
      <Card
        title="Benchmark universities"
        subtitle="Sample size and median for each institution"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>University</th>
                <th>Country</th>
                <th>Tier</th>
                <th>QS 2027</th>
                <th>Eligible</th>
                <th>Valid</th>
                <th>Median {metricNames[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((u) => (
                <tr key={u.country + u.id}>
                  <td>{u.label}</td>
                  <td>{u.country}</td>
                  <td>{u.key === "sl" ? "Sri Lanka" : u.key}</td>
                  <td>{u.qs}</td>
                  <td>{u.eligible}</td>
                  <td>{u.values.length}</td>
                  <td className={enough(u) && !weak(u) ? "" : "flag-cell"}>
                    {enough(u) ? <NumericValue value={median(u.values)} maximum={Math.max(0, ...tableRows.filter(enough).map(x => median(x.values) ?? 0))} /> : `n < ${minN}`}
                    {enough(u) && weak(u) && (
                      <small className="warn-text"> · weak coverage</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/**
 * Homepage preview. Like-for-like only: Sri Lanka is shown against the tiers
 * when enough Sri Lankan researchers have matched OpenAlex values.
 */
export function GlobalTeaser() {
  const d = useData();
  const theme = useAtlas((s) => s.theme);
  const col = palette[theme];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const [b, setB] = useState<Benchmarks | null>(null);
  useEffect(() => {
    loadBenchmarks().then(setB, () => setB(null));
  }, []);
  if (!b) return null;
  const eligible = d.academics.filter((a) => defaultBenchmarkFields.includes(matchedField(a)));
  const sl = eligible
    .map((a) => {
      const o = b.slOpenAlex.get(a.id);
      return o && isMatched(o.status) ? o.hIndex : null;
    })
    .filter((v): v is number => v !== null);
  const bars = [
    ...(sl.length >= minN
      ? [
          {
            label: "Sri Lanka",
            hint: "Collected profiles",
            key: "sl" as const,
            v: sl,
          },
        ]
      : []),
    ...TIERS.map((t) => ({
      label: tierShort[t],
      hint:
        t === "elite"
          ? "Top 2 per country"
          : t === "middle"
            ? "QS ~420–560"
            : "QS ~800–1200",
      key: t,
      v: b.academics
        .filter((a) => a.tier === t && a.unitType !== "proxy" && defaultBenchmarkFields.includes(a.field))
        .map((a) => a.hIndex)
        .filter((x): x is number => x !== null && Number.isFinite(x)),
    })),
  ].map((row) => ({
    ...row,
    value: row.v.length >= minN ? median(row.v) : null,
  }));
  const maximum = Math.max(1, ...bars.map((row) => row.value ?? 0));
  return (
    <Card
      className="global-preview"
      title="Sri Lanka & global benchmarks"
      subtitle="Median h-index · selected disciplines"
      action={
        <Link className="text-link" to="/global">
          Explore benchmarks →
        </Link>
      }
    >
      {sl.length < minN && (
        <p className="measurement-note warn">
          Sri Lanka: {sl.length} matched profiles; at least {minN} needed.
        </p>
      )}
      <ul
        className="benchmark-bars"
        aria-label="Median OpenAlex h-index comparison"
      >
        {bars.map((row) => (
          <li
            key={row.key}
            className={
              row.key === "sl" ? "benchmark-row is-local" : "benchmark-row"
            }
            title={`${row.label}: ${row.value === null ? "Insufficient data" : row.value.toFixed(1)} median h-index; ${row.v.length} matched profiles. ${row.hint}.`}
          >
            <div className="benchmark-label">
              <strong>{row.label}</strong>
              <span>{row.hint}</span>
            </div>
            <div className="benchmark-track" aria-hidden="true">
              {row.value !== null && (
                <span
                  style={{
                    width: `${(100 * row.value) / maximum}%`,
                    backgroundColor: col[row.key],
                  }}
                />
              )}
            </div>
            <strong className="benchmark-value">
              {row.value === null ? "—" : row.value.toFixed(1)}
            </strong>
          </li>
        ))}
      </ul>
      <p className="benchmark-caption">
        OpenAlex · QS 2027 samples · 7 countries · Matched profiles only
      </p>
    </Card>
  );
}
