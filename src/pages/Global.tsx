import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import {
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
type Unit = Group & { id: string; country: string; qs: string };

export { isMatched };

export function Global() {
  const d = useData();
  const theme = useAtlas((s) => s.theme);
  const col = palette[theme];
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const [b, setB] = useState<Benchmarks | null>(null),
    [error, setError] = useState(""),
    [metric, setMetric] = useState<GMetric>("hIndex"),
    [field, setField] = useState<"matched" | "Computer Science" | "Physics">(
      "matched",
    ),
    [stage, setStage] = useState<"all" | (typeof STAGES)[number]>("all"),
    [mode, setMode] = useState<"likeForLike" | "exploratory">("likeForLike"),
    [includeProxy, setIncludeProxy] = useState(false),
    [log, setLog] = useState(true);
  useEffect(() => {
    loadBenchmarks().then(setB, (e) => setError(String(e)));
  }, []);

  const view = useMemo(() => {
    if (!b) return null;
    const fieldOk = (f: string) => field === "matched" || f === field;
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
            u.short,
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
          ...build("sl", u.short, rows.map(slValue), rows.length),
          id: u.id,
          country: "Sri Lanka",
          qs: b.metadata.sriLankaQs[u.id] || "not ranked",
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
    legend: { top: 0, data: TIERS.map((t) => tierShort[t]) },
    grid: { left: 60, right: 20, top: 45, bottom: 30, containLabel: true },
    xAxis: {
      type: "category",
      data: COUNTRIES,
      axisLabel: { fontSize: 13, interval: 0, rotate: 30 },
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
  const ladderUnits = view.units
    .filter((u) => enough(u) && median(u.plotted) !== null)
    .map((u) => ({ ...u, med: median(u.plotted)! }))
    .sort((a, b) => a.med - b.med);
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
      data: ladderUnits.map((u) => `${u.label} · ${u.country}`),
      axisLabel: { fontSize: 12 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 12,
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
  const scatterUnits = ladderUnits.filter((u) => qsNumeric(u.qs) !== null);
  const scatter = {
    tooltip: { trigger: "item", confine: true },
    legend: { top: 0 },
    grid: { left: 60, right: 30, top: 75, bottom: 55, containLabel: true },
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
      min: log ? undefined : 0,
      name: `Median ${metricNames[metric]}`,
      nameLocation: "middle",
      nameGap: 50,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: (["elite", "middle", "lower", "sl"] as const).map((t) => ({
      type: "scatter",
      name: t === "sl" ? "Sri Lanka" : tierShort[t],
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
          "Sri Lankan collected profiles in matched disciplines and international QS-tier samples (Computer Science, Physics)",
        filters: {
          discipline:
            field === "matched" ? "Computer Science + Physics" : field,
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
        label={g.key === "sl" ? "Sri Lanka" : tierLabels[g.key as Tier]}
        value={m === null ? "Insufficient sample" : fmt(m, 1)}
        detail={`Median ${metricNames[metric]} · ${describe(g)}${m === null ? ` (minimum ${minN})` : ""}`}
      />
    );
  };

  return (
    <>
      <Header
        eyebrow="Sri Lanka · International benchmarks"
        title="How does Sri Lanka compare?"
        description={`Sri Lankan academics against samples from ${b.universities.length} universities in seven countries, grouped by QS 2027 tier. Benchmarks are samples, not national censuses.`}
        action={
          <Button variant="ghost" onClick={exportTable}>
            Export statistics CSV
          </Button>
        }
      />
      {mode === "likeForLike" ? (
        <div className="notice" role="note">
          Like-for-like: both sides use OpenAlex, matched by name within each
          institution. Sri Lankan OpenAlex matching: {view.slMatched.length}{" "}
          matched of {view.attempted} attempted lookups, out of {view.sl.length}{" "}
          eligible Sri Lankan academics in these disciplines. Groups with fewer
          than {minN} valid values are not reported.{" "}
          <a
            href="#benchmark-method"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("benchmark-method")?.scrollIntoView();
            }}
          >
            How the benchmarks were built
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
          <select
            aria-label="Comparison provider"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="likeForLike">
              Like-for-like (OpenAlex both sides)
            </option>
            <option value="exploratory">Exploratory: mixed providers</option>
          </select>
        </label>
        <label className="field">
          Metric
          <select
            aria-label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as GMetric)}
          >
            {Object.entries(metricNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Equivalent discipline
          <select
            aria-label="Equivalent discipline"
            value={field}
            onChange={(e) => setField(e.target.value as typeof field)}
          >
            <option value="matched">Computer Science + Physics</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Physics">Physics</option>
          </select>
        </label>
        <label className="field">
          Career stage
          <select
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
          </select>
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
      <div className="inline-note">
        Sri Lankan academics are included when their department or faculty name
        identifies Computer Science/computing or Physics. Career stages map
        different national title systems onto approximate equivalents.
        {includeProxy &&
          ` Proxy units (${view.proxies.length} academics) stand in for a missing discipline, e.g. engineering where a university has no physics department; they are not fully equivalent.`}
        {view.labs > 0 &&
          ` ${view.labs} benchmark academics come from research-lab rosters that mix university faculty with research-agency staff.`}
        {log &&
          ` Log scale: ${zeroCount} zero value${zeroCount === 1 ? " is" : "s are"} left out of the charts (never changed to 1) but remain in the medians.`}
      </div>
      <div className="stats-grid">{view.tierGroups.map(statFor)}</div>
      <div className="two-columns">
        <Card
          title="Sri Lanka against each tier"
          subtitle="Box: middle 50% of academics; whiskers: observed range. ⚠ marks groups below the minimum sample; they are not drawn."
        >
          <Chart
            option={box}
            height={400}
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
            height={400}
            label="Grouped bar chart of tier medians by country with a Sri Lanka reference line"
          />
        </Card>
      </div>
      <Card
        title="Where universities sit"
        subtitle={`Median per university, only where at least ${minN} academics have values. Sri Lankan institutions are orange.`}
      >
        {hiddenSl.length > 0 && (
          <p className="caption">
            Not shown (insufficient Sri Lankan sample):{" "}
            {hiddenSl
              .map((u) => `${u.label} (${u.values.length} of ${u.eligible})`)
              .join(", ")}
            .
          </p>
        )}
        <Chart
          option={ladder}
          height={Math.max(420, ladderUnits.length * 17 + 60)}
          label="Ranked bar chart of university medians"
          exportStats={exportTable}
        />
      </Card>
      <Card
        title="QS position and research metric"
        subtitle="Better QS rank to the right. Sri Lankan universities sit at the midpoint of their published QS 2027 band; universities below the minimum sample are omitted."
      >
        <Chart
          option={scatter}
          height={430}
          label="Scatter of QS 2027 position against university median"
        />
      </Card>
      <Card
        title="Benchmark universities"
        subtitle="Universities chosen from QS 2027, with eligible and valid counts. Substitutions are explained below."
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
                    {enough(u) ? fmt(median(u.values), 1) : `n < ${minN}`}
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
      <section className="card" id="benchmark-method">
        <div className="section-heading">
          <div>
            <h2>How the benchmarks were built</h2>
            <p>{b.metadata.qsEdition}</p>
          </div>
        </div>
        <ul className="method-list">
          <li>
            Each country has two elite universities (the top two with an
            accessible official staff directory), two middle-tier universities
            (QS ~420–560) and two lower-tier universities (QS ~800–1200, the
            band of the University of Colombo). Australia has one lower-tier
            university: the others in that band block automated access.
          </li>
          <li>
            Computer Science and Physics rosters come from official directories;
            visiting, adjunct, courtesy and emeritus staff are excluded.
            Departments larger than 25 are sampled systematically in directory
            order. Samples are not national censuses.
          </li>
          <li>
            OpenAlex researchers are matched by name within the university's
            OpenAlex institution. Ambiguous names (two plausible profiles) and
            implausibly merged profiles are left blank, not guessed. An
            attempted lookup is never counted as a match.
          </li>
          <li>
            Elite directories mostly list tenure-track professors, while Sri
            Lankan lists include lecturers and probationary staff. Use the
            career-stage control to compare similar positions.
          </li>
          <li>
            No overall performance score is produced. Medians describe the
            sampled academics with valid values only.
          </li>
          <li>
            The editable data, source rosters and build scripts are in{" "}
            <code>Data files/international/</code> and{" "}
            <code>scripts/baselines/</code>.
          </li>
        </ul>
        <h3>Substitutions</h3>
        <ul className="method-list">
          {b.universities
            .filter((u) => u.substitution)
            .map((u) => (
              <li key={u.id}>
                <strong>{u.short}</strong> ({u.country}, {u.tier}):{" "}
                {u.substitution}
              </li>
            ))}
        </ul>
      </section>
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
  const eligible = d.academics.filter((a) => matchedField(a));
  const sl = eligible
    .map((a) => {
      const o = b.slOpenAlex.get(a.id);
      return o && isMatched(o.status) ? o.hIndex : null;
    })
    .filter((v): v is number => v !== null);
  const bars = [
    ...(sl.length >= minN
      ? [{ label: "Sri Lanka", key: "sl" as const, v: sl }]
      : []),
    ...[...TIERS].reverse().map((t) => ({
      label: tierLabels[t],
      key: t,
      v: b.academics
        .filter((a) => a.tier === t && a.unitType !== "proxy")
        .map((a) => a.hIndex)
        .filter((x): x is number => x !== null),
    })),
  ];
  return (
    <Card
      title="How does Sri Lanka compare internationally?"
      subtitle="Median OpenAlex h-index in Computer Science and Physics: Sri Lanka against QS 2027 tier samples from seven countries, using the same provider on both sides."
      action={
        <Link className="text-link" to="/global">
          Open Global Benchmarks
        </Link>
      }
    >
      {sl.length < minN && (
        <div className="measurement-note warn">
          <span className="warn-text">
            <AlertTriangle size={14} aria-hidden="true" /> Sri Lanka is not
            shown yet: only {sl.length} of {eligible.length} Sri Lankan Computer
            Science and Physics academics have a matched OpenAlex profile
            (minimum {minN}). Comparing collected Google Scholar values with
            OpenAlex benchmarks would not be like-for-like.
          </span>
        </div>
      )}
      <Chart
        height={sl.length >= minN ? 260 : 210}
        label="Median h-index for the international tiers and, when available, Sri Lanka"
        option={{
          tooltip: { trigger: "item", confine: true },
          grid: {
            left: 10,
            right: 60,
            top: 10,
            bottom: 10,
            containLabel: true,
          },
          xAxis: {
            type: "value",
            splitLine: { lineStyle: { opacity: 0.35 } },
          },
          yAxis: {
            type: "category",
            inverse: true,
            data: bars.map((x) => x.label),
            axisLabel: { fontSize: 13 },
          },
          series: [
            {
              type: "bar",
              barMaxWidth: 18,
              label: {
                show: true,
                position: "right",
                formatter: (p: any) => fmt(p.value, 1),
              },
              data: bars.map((x) => ({
                value: median(x.v),
                n: x.v.length,
                itemStyle: {
                  color: x.key === "sl" ? col.sl : col[x.key],
                  borderRadius: [0, 4, 4, 0],
                },
              })),
              tooltip: {
                formatter: (p: any) =>
                  `${p.name}<br/>Median h-index ${fmt(p.value, 1)} (n=${p.data.n})`,
              },
            },
          ],
        }}
      />
    </Card>
  );
}
