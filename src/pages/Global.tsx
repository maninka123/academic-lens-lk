import { NumericValue } from "../components/common";
import { Select } from "../components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download } from "lucide-react";
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
  equivalentPosition,
  SENIOR_LECTURER_GROUP,
  isMatched,
  logSplit,
  MIN_SAMPLE,
  WEAK_COVERAGE,
} from "../analytics/quality";
import { exportStatistics, metricDefinitions } from "../analytics/exports";
import { Header, Card, Stat, Empty, fmt, short, CountryName } from "../components/common";
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
// Ordinal one-hue ramp (amber) for overseas tiers, and the primary indigo for Sri Lanka.
const palette = {
  light: {
    elite: "#9a5b08",
    middle: "#d99a2b",
    lower: "#f0cc85",
    sl: "#5d6cf0",
  },
  dark: {
    elite: "#f3c46f",
    middle: "#d99a2b",
    lower: "#9d6a1c",
    sl: "#8e9cff",
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
    [field, setField] = useState<BenchmarkField>("Computer Science"),
    [stage, setStage] = useState<"all" | (typeof STAGES)[number]>("all"),
    [mode, setMode] = useState<"likeForLike" | "exploratory">("likeForLike"),
    [includeProxy, setIncludeProxy] = useState(false),
    [log, setLog] = useState(true),
    [showAllUniversities, setShowAllUniversities] = useState(false),
    [posField, setPosField] = useState<BenchmarkField | "all">("all"),
    [posBy, setPosBy] = useState<"tier" | "country">("tier"),
    [posMetric, setPosMetric] = useState<GMetric>("hIndex"),
    [posLog, setPosLog] = useState(true),
    [tableQuery, setTableQuery] = useState(""),
    [tableTier, setTableTier] = useState<"all" | Tier | "sl">("all"),
    [tableAll, setTableAll] = useState(false);
  useEffect(() => {
    loadBenchmarks().then(setB, (e) => setError(String(e)));
  }, []);

  const view = useMemo(() => {
    if (!b) return null;
    const fieldOk = (f: string) => f === field;
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
      ...d.universities.filter((u) => !u.excludeFromComparison).map((u) => {
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

  // How the posMetric and the position mix vary by position, per group (Sri Lanka + tiers).
  const posView = useMemo(() => {
    if (!b) return null;
    const fieldOk = (f: string) => posField === "all" || f === posField;
    const intl = b.academics.filter(
      (a) => fieldOk(a.field) && (includeProxy || a.unitType !== "proxy"),
    );
    const sl = d.academics.filter((a) => {
      const f = matchedField(a);
      return f !== "" && fieldOk(f);
    });
    const slValue = (a: Academic) => {
      if (mode === "exploratory") return a[posMetric];
      const o = b.slOpenAlex.get(a.id);
      return o && isMatched(o.status) ? (o[posMetric] ?? null) : null;
    };
    // Positions that mean the same seniority are grouped: a Lecturer sits with an Assistant Professor
    // elsewhere, a Senior Lecturer with an Associate Professor.
    const cats = ["Lecturer", SENIOR_LECTURER_GROUP, "Professor"];
    const catOf = (rank: string) =>
      rank === "Senior Professor" || rank === "Professor"
        ? "Professor"
        : equivalentPosition(rank) === SENIOR_LECTURER_GROUP
          ? SENIOR_LECTURER_GROUP
          : ["Lecturer", "Assistant Professor", "Assistant Lecturer"].includes(rank)
            ? "Lecturer"
            : "";
    const countries = [...new Set(intl.map((a) => a.country).filter(Boolean))].sort();
    const sets: { key: string; label: string; rows: { cat: string; v: number | null | undefined }[] }[] = [
      { key: "sl", label: "Sri Lanka", rows: sl.map((a) => ({ cat: catOf(a.rank), v: slValue(a) })) },
      ...(posBy === "tier"
        ? (["elite", "middle", "lower"] as Tier[]).map((t) => ({
            key: t as string,
            label: tierShort[t],
            rows: intl.filter((a) => a.tier === t).map((a) => ({ cat: catOf(a.rank), v: a[posMetric] })),
          }))
        : countries.map((c) => ({
            key: c as string,
            label: c,
            rows: intl.filter((a) => a.country === c).map((a) => ({ cat: catOf(a.rank), v: a[posMetric] })),
          }))),
    ];
    return {
      cats,
      groups: sets.map((g) => {
        const total = g.rows.filter((r) => cats.includes(r.cat)).length;
        return {
          key: g.key,
          label: g.label,
          total,
          cells: cats.map((c) => {
            const inCat = g.rows.filter((r) => r.cat === c);
            const vals = inCat
              .map((r) => r.v)
              .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
            const st = summary(vals);
            return {
              cat: c,
              n: vals.length,
              all: inCat.length,
              share: total ? (100 * inCat.length) / total : 0,
              median: vals.length >= minN ? st.median : null,
              q1: vals.length >= minN ? st.q1 : null,
              q3: vals.length >= minN ? st.q3 : null,
            };
          }),
        };
      }),
    };
  }, [b, d, posMetric, posField, posBy, mode, includeProxy, minN]);

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
    (weak(g) ? ` | weak coverage (${fmt(coverage(g), 1)}%)` : "");
  const zeroCount = view.tierGroups.reduce((s, g) => s + g.zeros, 0);

  // 1 | Box plot: Sri Lanka vs each tier (insufficient groups are not drawn).
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
            return `${g.label}<br/>Median ${fmt(s.median, 1)} | IQR ${fmt(s.q1, 1)}–${fmt(s.q3, 1)}<br/>${describe(g)}${log && g.zeros ? `<br/>${g.zeros} zero values not drawn` : ""}`;
          },
        },
      },
    ],
  };

  // 2 | Country × tier medians with the Sri Lanka median as a reference line.
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
            ? `${p.name} | ${tierShort[t]}<br/>Median ${fmt(p.value, 1)} (${p.data.n} valid of ${p.data.eligible})`
            : `${p.name} | ${tierShort[t]}<br/>Insufficient sample (${p.data.n} valid; minimum ${minN})`,
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

  // 3 | University ladder (median), only universities with an adequate sample.
  const allLadderUnits = view.units
    .filter((u) => enough(u) && median(u.values) !== null)
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
      type: "value",
      min: 0,
      name: `Median ${metricNames[metric]}${log ? " (compressed scale)" : ""}`,
      axisLabel: log ? { formatter: (v: number) => fmt(10 ** v - 1, 1) } : undefined,
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
          formatter: (p: any) => fmt(p.data.actual, 1),
        },
        data: ladderUnits.map((u) => ({
          value: log ? Math.log10(u.med + 1) : u.med,
          actual: u.med,
          itemStyle: { color: colorOf(u.key), borderRadius: [0, 4, 4, 0] },
          unit: u,
        })),
        tooltip: {
          formatter: (p: any) => {
            const u: Unit = p.data.unit;
            return `${u.label} (${u.country})<br/>${u.key === "sl" ? "Sri Lanka" : tierLabels[u.key as Tier]} | QS 2027 ${u.qs}<br/>Median ${fmt(median(u.values), 1)} | ${describe(u)}`;
          },
        },
      },
    ],
  };

  // 4 | QS position vs median metric.
  const scatterUnits = allLadderUnits.filter((u) => qsNumeric(u.qs) !== null && (!log || u.med > 0));
  const scatter = {
    tooltip: { trigger: "item", confine: true },
    legend: {
      show: true,
      top: 0,
      left: 0,
      itemGap: 18,
      textStyle: { fontSize: 13 },
      data: ["Elite tier", "Middle tier", "Lower tier", "Sri Lanka"],
    },
    grid: { left: 10, right: 24, top: 46, bottom: 56, containLabel: true },
    xAxis: {
      type: "log",
      name: "QS 2027 world rank (log scale; better rank is further right)",
      nameLocation: "middle",
      nameGap: 36,
      inverse: true,
      min: 1,
      max: 1600,
      axisLabel: { fontSize: 12, customValues: [1, 10, 30, 100, 300, 1000], formatter: (v: number) => String(Math.round(v)) },
      splitLine: { lineStyle: { opacity: 0.25 } },
    },
    yAxis: {
      type: log ? "log" : "value",
      min: log ? Math.pow(10, Math.floor(Math.log10(Math.min(...scatterUnits.map(u => u.med), ...(slMedian !== null && slMedian > 0 ? [slMedian] : []))))) : 0,
      name: `Median ${metricNames[metric]}`,
      nameLocation: "middle",
      nameGap: 44,
      splitLine: { lineStyle: { opacity: 0.3 } },
    },
    series: (["elite", "middle", "lower", "sl"] as const).map((t) => ({
      type: "scatter",
      name: t === "sl" ? "Sri Lanka" : tierShort[t],
      // Faint bands show where each tier's universities sit on the QS scale.
      markArea:
        t === "elite"
          ? {
              silent: true,
              label: { show: true, position: "insideTop", fontSize: 11, color: "#8189a0" },
              data: [
                [{ xAxis: 1, name: "Elite", itemStyle: { color: col.elite + "14" } }, { xAxis: 150 }],
                [{ xAxis: 420, name: "Middle", itemStyle: { color: col.middle + "14" } }, { xAxis: 560 }],
                [{ xAxis: 800, name: "Lower", itemStyle: { color: col.lower + "14" } }, { xAxis: 1250 }],
              ],
            }
          : undefined,
      markLine:
        t === "sl" && slMedian !== null && (!log || slMedian > 0)
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { color: col.sl, type: "dashed", width: 2 },
              label: { show: true, position: "insideEndTop", formatter: `Sri Lanka median ${fmt(slMedian, 1)}`, color: col.sl, fontSize: 12, fontWeight: 600 },
              data: [{ yAxis: slMedian }],
            }
          : undefined,
      symbol: t === "sl" ? "diamond" : "circle",
      symbolSize: t === "sl" ? 15 : 12,
      itemStyle: {
        color: colorOf(t),
        borderColor: theme === "dark" ? "#0e1220" : "#ffffff",
        borderWidth: 2,
      },
      label: {
        show: t === "sl",
        formatter: (p: any) => short(p.data.unit.label),
        position: "top",
        fontSize: 11,
        color: "inherit",
      },
      data: scatterUnits
        .filter((u) => u.key === t)
        .map((u) => ({ value: [qsNumeric(u.qs), u.med], unit: u })),
      tooltip: {
        formatter: (p: any) => {
          const u: Unit = p.data.unit;
          return `${u.label} (${u.country})\nQS 2027: ${u.qs}\nMedian ${metricNames[metric]}: ${fmt(median(u.values), 1)}\nBased on ${u.values.length} of ${u.eligible} profiles`;
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
        title: `Global benchmarks | ${metricNames[metric]}`,
        population:
          "Sri Lankan collected profiles in matched disciplines and international QS-tier samples (seven covered disciplines)",
        filters: {
          discipline: field,
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

  const filteredRows = tableRows.filter(
    (u) =>
      (tableTier === "all" || u.key === tableTier) &&
      (u.label + " " + u.country).toLowerCase().includes(tableQuery.trim().toLowerCase()),
  );
  const shownRows = tableAll || tableQuery || tableTier !== "all" ? filteredRows : filteredRows.slice(0, 12);
  const tierNotes: Record<Tier, string> = {
    elite: "Top 2 universities per country",
    middle: "QS rank about 420-560",
    lower: "QS rank about 800-1200",
  };
  const tierRows = [
    ...(["elite", "middle", "lower"] as Tier[]).map((t) => {
      const g = view.tierGroups.find((x) => x.key === t)!;
      return { key: t as Tier | "sl", name: tierShort[t], note: tierNotes[t], median: medianOf(g), n: g.values.length };
    }),
    { key: "sl" as Tier | "sl", name: "Sri Lanka", note: `${fmt(sl.eligible)} collected profiles in this selection`, median: slMedian, n: sl.values.length },
  ];
  const tierMax = Math.max(1, ...tierRows.map((r) => r.median ?? 0));
  const tierRatios =
    slMedian === null
      ? []
      : tierRows
          .filter((r) => r.key !== "sl" && r.median !== null && r.median > 0)
          .reverse()
          .map((r) => ({ name: r.name.toLowerCase(), pct: Math.round((100 * slMedian) / r.median!) }));
  const posColors = ["#c5ccfa", "#6f7df0", "#2b3aa8"];
  const countryColors: Record<string, string> = {
    "United States": "#2b3aa8",
    Australia: "#1ea896",
    China: "#8b6df0",
    India: "#e0586f",
    Canada: "#d99a2b",
    France: "#6b8ab8",
    Germany: "#4aa3df",
  };
  const posColor = (key: string) =>
    key === "sl" ? col.sl : key in col ? (col as Record<string, string>)[key] : countryColors[key] ?? "#8a8fa3";
  const posCats = posView?.cats ?? [];
  const posN = posView?.groups.length ?? 4;
  const posOffsets = Array.from({ length: posN }, (_, i) => (posN === 1 ? 0 : -0.32 + (0.64 * i) / (posN - 1)));
  const useLog = posLog;
  const posChart: any = posView && {
    legend: { show: false },
    tooltip: {
      confine: true,
      formatter: (p: any) => {
        const v = p.data?.value;
        if (!v) return "";
        return `${p.seriesName} | ${posCats[Math.round(v[0] - p.data.off) - 1]}\nMedian ${metricNames[posMetric]}: ${fmt(v[1], 1)}\nMiddle 50%: ${fmt(v[2], 1)} to ${fmt(v[3], 1)}\nValid profiles: ${v[4]}`;
      },
    },
    grid: { left: 10, right: 20, top: 24, bottom: 52, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      max: posCats.length + 1,
      interval: 1,
      splitLine: { show: false },
      axisLabel: {
        fontSize: 13,
        formatter: (v: number) => {
          const c = Number.isInteger(v) ? posCats[v - 1] : undefined;
          if (!c) return "";
          return c;
        },
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: useLog ? "log" : "value",
      name: metricNames[posMetric],
      nameLocation: "middle",
      nameGap: 46,
      min: useLog ? 0.5 : 0,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: posView.groups.flatMap((g, gi) => {
      const color = posColor(g.key);
      const cells = g.cells
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.median !== null && c.q1 !== null && c.q3 !== null);
      const off = posOffsets[gi];
      const clamp = (v: number) => (useLog ? Math.max(v, 0.5) : v);
      return [
        {
          type: "line",
          name: g.label,
          silent: true,
          symbol: "none",
          lineStyle: { color, width: 2.5, opacity: 0.8, type: "dashed" },
          data: cells.map(({ c, i }) => [i + 1 + off, clamp(c.median as number)]),
          z: 1,
        },
        {
          type: "custom",
          name: g.label,
          z: 3,
          data: cells.map(({ c, i }) => ({
            off,
            value: [i + 1 + off, clamp(c.median as number), clamp(c.q1 as number), clamp(c.q3 as number), c.n],
          })),
          renderItem: (_: unknown, api: any) => {
            const x = api.coord([api.value(0), api.value(1)])[0];
            const ym = api.coord([api.value(0), api.value(1)])[1];
            const y1 = api.coord([api.value(0), api.value(2)])[1];
            const y3 = api.coord([api.value(0), api.value(3)])[1];
            return {
              type: "group",
              children: [
                { type: "line", shape: { x1: x, y1, x2: x, y2: y3 }, style: { stroke: color, lineWidth: 6, opacity: 0.85 } },
                { type: "line", shape: { x1: x - 7, y1, x2: x + 7, y2: y1 }, style: { stroke: color, lineWidth: 3 } },
                { type: "line", shape: { x1: x - 7, y1: y3, x2: x + 7, y2: y3 }, style: { stroke: color, lineWidth: 3 } },
                { type: "circle", shape: { cx: x, cy: ym, r: posN > 4 ? 5 : 7 }, style: { fill: color, stroke: "#ffffff", lineWidth: 2 } },
              ],
            };
          },
        },
      ];
    }),
  };
  const posMix: any = posView && {
    tooltip: { trigger: "item", confine: true, valueFormatter: (v: number) => fmt(v, 0) + "%" },
    legend: { show: false },
    grid: { left: 10, right: 20, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { opacity: 0.3 } } },
    yAxis: { type: "category", inverse: true, data: posView.groups.map((g) => `${g.label}\nn=${g.total}`), axisLabel: { fontSize: 12 } },
    series: posCats.map((cat, i) => ({
      type: "bar",
      name: cat,
      stack: "mix",
      barMaxWidth: 34,
      itemStyle: { color: posColors[i % posColors.length] },
      label: { show: true, color: i === 0 ? "#0b1020" : "#ffffff", formatter: (p: any) => (p.value >= 8 ? Math.round(p.value) + "%" : "") },
      data: posView.groups.map((g) => g.cells[i].share),
    })),
  };
  const posInsight = (() => {
    if (!posView) return "";
    const top = posCats[posCats.length - 1];
    const cell = (key: string) => posView.groups.find((g) => g.key === key)?.cells.find((c) => c.cat === top);
    const s0 = cell("sl")?.median ?? null;
    if (s0 === null) return `Sri Lanka has too few valid ${top.toLowerCase()} profiles for this discipline to compare (needs ${minN}).`;
    const others = posView.groups
      .filter((g) => g.key !== "sl")
      .map((g) => [g.key, cell(g.key)?.median ?? null] as const);
    const parts = others
      .filter(([, v]) => v !== null && v > 0)
      .map(([k, v]) =>
        posBy === "tier"
          ? `${Math.round((100 * s0) / (v as number))}% of the ${k} tier (${fmt(v, 1)})`
          : `${Math.round((100 * s0) / (v as number))}% of ${k} (${fmt(v, 1)})`,
      );
    return `Among ${top === "Professor" ? "professors" : top.toLowerCase()}, Sri Lanka's median ${metricNames[posMetric].toLowerCase()} is ${fmt(s0, 1)}${parts.length ? ", which is " + parts.join(", ") : ""}.`;
  })();
  const statFor = (g: Group) => {
    const m = medianOf(g);
    return (
      <Stat
        key={g.key}
        label={g.key === "sl" ? "Sri Lanka" : tierShort[g.key as Tier]}
        value={m === null ? "—" : fmt(m, 1)}
        detail={`${g.values.length} valid profiles${m === null ? " | insufficient data" : " | median " + metricNames[metric]}`}
      />
    );
  };

  return (
    <>
      <Header
        eyebrow="Sri Lanka | International benchmarks"
        title="Global benchmarks"
        description={`${b.universities.length} universities | 7 countries | QS 2027 tiers`}
        action={
          <Button variant="ghost" onClick={exportTable}>
            <Download size={17} aria-hidden="true" />
            Export statistics CSV
          </Button>
        }
      />
      {mode === "likeForLike" ? (
        <div className="benchmark-method-note" role="note">
          <span>
            OpenAlex on both sides | {view.slMatched.length} Sri Lankan matches
            | Minimum {minN} valid profiles per group
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
          Measure
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
          Discipline
          <Select
            aria-label="Equivalent discipline"
            value={field}
            onChange={(e) => setField(e.target.value as typeof field)}
          >
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
        <details className="global-options">
          <summary>More options</summary>
          <div>
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
        </details>
      </div>
      {(includeProxy || log) && (
        <p className="chart-note">
          {includeProxy ? "Proxy disciplines included | " : ""}
          {log
            ? `Log scale: ${zeroCount} zero values remain in summaries but are not plotted.`
            : ""}
        </p>
      )}
      <section className="tier-summary" aria-label="Sri Lanka against the QS tiers">
        <div className="tier-summary-text">
          <span className="eyebrow">What this shows</span>
          <h2>
            {slMedian === null
              ? `Sri Lanka has too few valid profiles for this selection (${sl.values.length}, minimum ${minN}).`
              : `Sri Lanka's median ${metricNames[metric].toLowerCase()} is ${fmt(slMedian, 1)}.`}
          </h2>
          <ul className="point-list">
            <li>
              {slMedian === null
                ? "Try another measure, discipline or career stage. Missing values are never treated as zero."
                : tierRatios.length
                  ? "That is " +
                    tierRatios.map((r) => `${r.pct}% of the ${r.name}`).join(", ") +
                    ` median for ${field}${stage === "all" ? "" : ", " + stage.toLowerCase()}.`
                  : "The international tiers have too few valid profiles to compare."}
            </li>
            {slMedian !== null && mode === "likeForLike" && sl.eligible > 0 && (
              <>
                <li>
                  Based on {fmt(sl.values.length)} of {fmt(sl.eligible)} Sri Lankan profiles ({Math.round((100 * sl.values.length) / sl.eligible)}%) with a verified OpenAlex match; the rest are not matched yet.
                </li>
                <li>
                  OpenAlex h-indices usually run lower than Google Scholar&rsquo;s, so compare Sri Lanka with the tiers here, not with the Scholar figures elsewhere.
                </li>
              </>
            )}
          </ul>
        </div>
        <ul className="tier-ladder">
          {tierRows.map((r) => (
            <li key={r.key} className={r.key}>
              <span className="tier-name">
                <i style={{ background: colorOf(r.key) }} />
                <b>{r.name}</b>
                <small>{r.note}</small>
              </span>
              <span className="tier-bar" aria-hidden="true">
                {r.median !== null && (
                  <span style={{ width: `${(100 * r.median) / tierMax}%`, background: colorOf(r.key) }} />
                )}
              </span>
              <strong className="tier-value">{r.median === null ? "—" : fmt(r.median, 1)}</strong>
              <small className="tier-n">
                {r.median === null
                  ? `not enough data (n=${r.n})`
                  : r.key === "sl" && mode === "likeForLike"
                    ? `${fmt(r.n)} of ${fmt(sl.eligible)} matched`
                    : `${fmt(r.n)} profiles`}
              </small>
            </li>
          ))}
        </ul>
      </section>
      <div className="two-columns">
        <Card
          title="Sri Lanka against each tier"
          subtitle="Box: middle 50% | Line: median | Whiskers: observed range"
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
              : `Dashed line: Sri Lankan median (${fmt(slMedian, 1)}) for the same selection.`
          }
        >
          <Chart
            option={byCountry}
            height={320}
            label="Grouped bar chart of tier medians by country with a Sri Lanka reference line"
          />
        </Card>
      </div>
      {posView && (
        <Card
          title="How it varies by position"
          subtitle={`${metricNames[posMetric]} by seniority. Each dot is a median and each bar the middle 50% of people; a cell needs ${minN}+ valid profiles.`}
        >
          <div className="pos-toolbar">
            <label className="field">
              Measure
              <Select
                aria-label="Position chart measure"
                value={posMetric}
                onChange={(e) => setPosMetric(e.target.value as GMetric)}
              >
                {Object.entries(metricNames).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </label>
            <label className="field">
              Discipline
              <Select
                aria-label="Position chart discipline"
                value={posField}
                onChange={(e) => setPosField(e.target.value as typeof posField)}
              >
                <option value="all">All disciplines</option>
                {benchmarkFields.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </label>
            <div className="field">
              <span>Scale</span>
              <div className="chip-group" role="group" aria-label="Chart scale">
                {([[false, "Linear"], [true, "Log"]] as const).map(([k, l]) => (
                  <button key={l} type="button" aria-pressed={posLog === k} onClick={() => setPosLog(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Compare Sri Lanka with</span>
              <div className="chip-group" role="group" aria-label="Comparison groups">
                {([["tier", "QS tiers"], ["country", "Countries"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={posBy === k} onClick={() => setPosBy(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="pos-insight">{posInsight}</p>
          <div className="pos-grid">
            <div className="pos-col">
              <h3 className="pos-sub">{metricNames[posMetric]} by position</h3>
              <Chart option={posChart} height={340} label="Median and middle 50% of the metric by position for Sri Lanka and each comparison group" />
              <div className="benchmark-key">
                {posView.groups.map((g) => (
                  <span key={g.key}><i style={{ background: posColor(g.key) }} />{g.label}</span>
                ))}
              </div>
            </div>
            <div className="pos-col">
              <h3 className="pos-sub">Who is in each group</h3>
              <Chart option={posMix} height={340} label="Share of people at each position in Sri Lanka and each comparison group" />
            </div>
          </div>
          <ul className="pos-key pos-key-row" aria-label="What each position group means">
            {posCats.map((c, i) => (
              <li key={c}>
                <i style={{ background: posColors[i % posColors.length] }} />
                <span>
                  <b>{c}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="caption">
            Job titles differ between countries, so people are grouped by seniority:
            a Sri Lankan "Lecturer" sits with an "Assistant Professor" elsewhere.
          </p>
        </Card>
      )}
      <Card
        title="Where universities sit"
        subtitle={`${allLadderUnits.filter(u => u.key === "sl").length} Sri Lankan institutions | at least ${minN} valid profiles | indigo bars`}
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
            <ul>{hiddenSl.map(u => <li key={u.id}><strong>{u.label}</strong><span>{mode === "likeForLike" && u.attempted === 0 ? `OpenAlex lookup pending | ${u.eligible} matching profiles` : `${u.values.length} usable values / ${u.eligible} matching profiles`}</span></li>)}</ul>
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
        title="Does a better QS rank mean a higher median?"
        subtitle="Each dot is one university's median. Shaded bands mark the three QS tiers; the dashed line is Sri Lanka's pooled median."
      >
        <Chart
          option={scatter}
          height={440}
          label="Scatter of QS 2027 position against university median"
        />
      </Card>
      <Card
        title="Benchmark universities"
        subtitle={`Median ${metricNames[metric].toLowerCase()} for each university, with how many profiles it rests on.`}
      >
        <div className="uni-toolbar bench-toolbar">
          <label className="uni-search">
            <input
              type="search"
              placeholder="Search university or country"
              aria-label="Search benchmark universities"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
            />
          </label>
          <div className="chip-group" role="group" aria-label="Tier">
            {([["all", "All"], ["elite", "Elite"], ["middle", "Middle"], ["lower", "Lower"], ["sl", "Sri Lanka"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={tableTier === k} onClick={() => setTableTier(k as typeof tableTier)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="bench-table">
            <thead>
              <tr>
                <th>University</th>
                <th>Tier</th>
                <th>QS 2027</th>
                <th>Profiles used</th>
                <th>Median {metricNames[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((u) => (
                <tr key={u.country + u.id}>
                  <td>
                    <strong>{u.label}</strong>
                    <small><CountryName country={u.country} /></small>
                  </td>
                  <td>
                    <span className={"tier-badge " + u.key}>{u.key === "sl" ? "Sri Lanka" : tierShort[u.key as Tier].replace(" tier", "")}</span>
                  </td>
                  <td>{u.qs}</td>
                  <td>{u.values.length} <small>of {u.eligible}</small></td>
                  <td className={enough(u) && !weak(u) ? "" : "flag-cell"}>
                    {enough(u) ? <NumericValue value={median(u.values)} maximum={Math.max(0, ...tableRows.filter(enough).map(x => median(x.values) ?? 0))} /> : `Not enough data (n < ${minN})`}
                    {enough(u) && weak(u) && (
                      <small className="warn-text"> | weak coverage</small>
                    )}
                  </td>
                </tr>
              ))}
              {!shownRows.length && (
                <tr><td colSpan={5} className="muted">No university matches.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 12 && (
          <Button variant="ghost" onClick={() => setTableAll(!tableAll)}>
            {tableAll ? "Show fewer" : `Show all ${filteredRows.length}`}
          </Button>
        )}
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
            hint: `${sl.length} matched profiles`,
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
      subtitle="Median h-index | selected disciplines"
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
            title={`${row.label}: ${row.value === null ? "Insufficient data" : fmt(row.value, 1)} median h-index; ${row.v.length} matched profiles. ${row.hint}.`}
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
              {row.value === null ? "—" : fmt(row.value, 1)}
            </strong>
          </li>
        ))}
      </ul>
      <p className="benchmark-caption">
        OpenAlex | QS 2027 samples | 7 countries | Matched profiles only
      </p>
    </Card>
  );
}
