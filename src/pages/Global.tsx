import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { summary, values, median } from "../analytics/engine";
import { Header, Card, Stat, Empty, fmt, download } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import Papa from "papaparse";

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
type Unit = {
  id: string;
  label: string;
  country: string;
  tier: Tier | "sl";
  qs: string;
  values: number[];
  n: number;
};

export function Global() {
  const d = useData();
  const theme = useAtlas((s) => s.theme);
  const col = palette[theme];
  const [b, setB] = useState<Benchmarks | null>(null),
    [error, setError] = useState(""),
    [metric, setMetric] = useState<GMetric>("hIndex"),
    [field, setField] = useState<"matched" | "Computer Science" | "Physics">(
      "matched",
    ),
    [slScope, setSlScope] = useState<"matched" | "all">("matched"),
    [log, setLog] = useState(true),
    [slSource, setSlSource] = useState<"openalex" | "collected">("collected");
  useEffect(() => {
    loadBenchmarks().then(setB, (e) => setError(String(e)));
  }, []);
  // Sri Lankan OpenAlex lookups can be partial (daily API budget); only default
  // to them once every populated Sri Lankan university is covered.
  const oaCoverage = useMemo(() => {
    if (!b) return { covered: 0, total: 0 };
    const populated = new Set(d.academics.map((a) => a.universityId));
    const covered = new Set(
      d.academics
        .filter((a) => b.slOpenAlex.has(a.id))
        .map((a) => a.universityId),
    );
    return { covered: covered.size, total: populated.size };
  }, [b, d]);
  const oaComplete =
    oaCoverage.total > 0 && oaCoverage.covered >= oaCoverage.total;
  useEffect(() => {
    if (oaComplete) setSlSource("openalex");
  }, [oaComplete]);

  const view = useMemo(() => {
    if (!b) return null;
    const fieldOk = (f: string) => field === "matched" || f === field;
    const intl = b.academics.filter((a) => fieldOk(a.field));
    const sl = d.academics
      .map((a) => ({ a, f: matchedField(a) }))
      .filter(({ f }) => (slScope === "all" ? true : f !== "" && fieldOk(f)))
      .map(({ a }) => a);
    const v = (rows: { [k: string]: any }[]) =>
      values(rows.map((r) => r[metric] as number | null));
    const useOa = slSource === "openalex" && b.slOpenAlex.size > 0;
    const slv = (rows: { id: string; [k: string]: any }[]) =>
      values(
        rows.map((r) =>
          useOa
            ? (b.slOpenAlex.get(r.id)?.[metric] ?? null)
            : (r[metric] as number | null),
        ),
      );
    const tierGroups = [
      {
        key: "sl" as const,
        label: "Sri Lanka",
        values: slv(sl),
        rows: sl.length,
      },
      ...[...TIERS].reverse().map((t) => {
        const rows = intl.filter((a) => a.tier === t);
        return {
          key: t,
          label: tierLabels[t],
          values: v(rows),
          rows: rows.length,
        };
      }),
    ];
    const units: Unit[] = [
      ...b.universities.map((u) => {
        const rows = intl.filter((a) => a.universityId === u.id);
        const vals = v(rows);
        return {
          id: u.id,
          label: u.short,
          country: u.country,
          tier: u.tier,
          qs: u.qsRank,
          values: vals,
          n: rows.length,
        };
      }),
      ...d.universities.map((u) => {
        const rows = sl.filter((a) => a.universityId === u.id);
        return {
          id: u.id,
          label: u.short,
          country: "Sri Lanka",
          tier: "sl" as const,
          qs: b.metadata.sriLankaQs[u.id] || "not ranked",
          values: slv(rows),
          n: rows.length,
        };
      }),
    ];
    return { intl, sl, tierGroups, units };
  }, [b, d, metric, field, slScope, slSource]);

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
  const slMedian = median(view.tierGroups[0].values);
  const covered = (n: number, total: number) =>
    total ? `${n} of ${total} with values` : "No records";

  // 1 · Box plot: Sri Lanka vs each tier.
  const box = {
    tooltip: { trigger: "item", confine: true },
    grid: { left: 70, right: 30, top: 30, bottom: 60, containLabel: true },
    xAxis: {
      type: "category",
      data: view.tierGroups.map(
        (g) =>
          `${g.key === "sl" ? "Sri Lanka" : tierShort[g.key as Tier].replace(" tier", "")}\nn=${g.values.length}`,
      ),
      axisLabel: { fontSize: 12, interval: 0 },
    },
    yAxis: {
      type: log ? "log" : "value",
      name: metricNames[metric],
      nameLocation: "middle",
      nameGap: 50,
      min: log ? 1 : 0,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series: [
      {
        type: "boxplot",
        name: metricNames[metric],
        data: view.tierGroups.map((g) => {
          const s = summary(g.values.map((x) => (log ? Math.max(x, 1) : x)));
          return {
            value: [s.min, s.q1, s.median, s.q3, s.max],
            itemStyle: {
              color: colorOf(g.key) + "33",
              borderColor: colorOf(g.key),
              borderWidth: 2,
            },
          };
        }),
        tooltip: {
          formatter: (p: any) => {
            const g = view.tierGroups[p.dataIndex];
            const s = summary(g.values);
            return `${g.label}<br/>Median ${fmt(s.median, 1)} · IQR ${fmt(s.q1, 1)}–${fmt(s.q3, 1)}<br/>${covered(g.values.length, g.rows)}`;
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
        const vals = values(
          view.intl
            .filter((a) => a.country === c && a.tier === t)
            .map((a) => a[metric]),
        );
        return { value: median(vals), n: vals.length };
      }),
      tooltip: {
        formatter: (p: any) =>
          `${p.name} · ${tierLabels[t]}<br/>Median ${fmt(p.value, 1)} (n=${p.data.n})`,
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

  // 3 · University ladder (median), Sri Lankan institutions highlighted.
  const ladderUnits = view.units
    .filter((u) => u.values.length >= 3)
    .map((u) => ({ ...u, med: median(u.values)! }))
    .sort((a, b) => a.med - b.med);
  const ladder = {
    tooltip: { trigger: "item", confine: true },
    grid: { left: 10, right: 50, top: 10, bottom: 30, containLabel: true },
    xAxis: {
      type: log ? "log" : "value",
      min: log ? 1 : 0,
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
          value: log ? Math.max(u.med, 1) : u.med,
          itemStyle: { color: colorOf(u.tier), borderRadius: [0, 4, 4, 0] },
          unit: u,
        })),
        tooltip: {
          formatter: (p: any) => {
            const u: Unit = p.data.unit;
            return `${u.label} (${u.country})<br/>${u.tier === "sl" ? "Sri Lanka" : tierLabels[u.tier]} · QS 2027 ${u.qs}<br/>Median ${fmt(median(u.values), 1)} · ${covered(u.values.length, u.n)}`;
          },
        },
      },
    ],
  };

  // 4 · QS position vs median metric.
  const scatterUnits = view.units.filter(
    (u) => u.values.length >= 3 && qsNumeric(u.qs) !== null,
  );
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
      min: log ? 1 : 0,
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
        .filter((u) => u.tier === t)
        .map((u) => ({
          value: [qsNumeric(u.qs), Math.max(median(u.values)!, log ? 1 : 0)],
          unit: u,
        })),
      tooltip: {
        formatter: (p: any) => {
          const u: Unit = p.data.unit;
          return `${u.label} (${u.country})<br/>QS 2027 ${u.qs}<br/>Median ${fmt(median(u.values), 1)} · ${covered(u.values.length, u.n)}`;
        },
      },
    })),
  };

  const tableRows = [...view.units]
    .filter((u) => u.n > 0)
    .sort(
      (a, b) =>
        (qsNumeric(a.qs) ?? 9999) - (qsNumeric(b.qs) ?? 9999) ||
        a.label.localeCompare(b.label),
    );
  const exportTable = () =>
    download(
      "global-benchmarks.csv",
      "﻿" +
        Papa.unparse(
          tableRows.map((u) => ({
            university: u.label,
            country: u.country,
            tier: u.tier === "sl" ? "Sri Lanka" : u.tier,
            qs_rank_2027: u.qs,
            sampled_academics: u.n,
            with_values: u.values.length,
            ["median_" + metric]: median(u.values),
          })),
        ),
    );

  const statFor = (i: number) => {
    const g = view.tierGroups[i];
    const m = median(g.values);
    return (
      <Stat
        key={g.key}
        label={g.key === "sl" ? "Sri Lanka" : tierLabels[g.key as Tier]}
        value={m === null ? "Not available" : fmt(m, 1)}
        detail={`Median ${metricNames[metric]} · ${covered(g.values.length, g.rows)}`}
      />
    );
  };

  return (
    <>
      <Header
        eyebrow="Sri Lanka · International benchmarks"
        title="How does Sri Lanka compare?"
        description={`Sri Lankan academics against samples from ${b.universities.length} universities in seven countries, grouped by QS 2027 tier: elite, middle and lower.`}
        action={
          <Button variant="ghost" onClick={exportTable}>
            Export summary CSV
          </Button>
        }
      />
      <div className="notice" role="note">
        {slSource === "openalex" && b.slOpenAlex.size
          ? "Both sides use OpenAlex metrics, matched by name within each institution. Ambiguous names are left out on both sides."
          : "Benchmark metrics come from OpenAlex, but the Sri Lankan values shown are collected Google Scholar and ResearchGate snapshots, which usually report higher counts. Treat gaps as indicative."}{" "}
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
      <div className="global-controls">
        <label className="field">
          Metric
          <select
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
          Discipline
          <select
            value={field}
            onChange={(e) => setField(e.target.value as typeof field)}
          >
            <option value="matched">Computer Science + Physics</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Physics">Physics</option>
          </select>
        </label>
        <label className="field">
          Sri Lankan group
          <select
            value={slScope}
            onChange={(e) => setSlScope(e.target.value as typeof slScope)}
          >
            <option value="matched">Same disciplines only</option>
            <option value="all">All collected academics</option>
          </select>
        </label>
        <label className="field">
          Sri Lankan metric source
          <select
            value={slSource}
            onChange={(e) => setSlSource(e.target.value as typeof slSource)}
          >
            <option value="openalex" disabled={!b.slOpenAlex.size}>
              {oaComplete
                ? "OpenAlex (same source as benchmarks)"
                : `OpenAlex (partial: ${oaCoverage.covered} of ${oaCoverage.total} universities)`}
            </option>
            <option value="collected">
              Collected profiles (Scholar / ResearchGate)
            </option>
          </select>
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
      <div className="stats-grid">
        {view.tierGroups.map((_, i) => statFor(i))}
      </div>
      <div className="two-columns">
        <Card
          title="Sri Lanka against each tier"
          subtitle="Box shows the middle 50% of academics; whiskers show the observed range."
        >
          <Chart
            option={box}
            height={400}
            label="Box plot of the metric for Sri Lanka and the three international tiers"
          />
        </Card>
        <Card
          title="Tier medians by country"
          subtitle={`Orange dashed line: Sri Lankan median${slMedian === null ? "" : ` (${fmt(slMedian, 1)})`} for the same selection.`}
        >
          <Chart
            option={byCountry}
            height={400}
            label="Grouped bar chart of tier medians by country with a Sri Lanka reference line"
          />
        </Card>
      </div>
      <Card
        title="Where Sri Lankan universities sit"
        subtitle="Each university's median (at least 3 academics with values), coloured by tier. Sri Lankan institutions are orange."
      >
        <Chart
          option={ladder}
          height={Math.max(420, ladderUnits.length * 17 + 60)}
          label="Ranked bar chart of university medians"
        />
      </Card>
      <Card
        title="QS position and research metric"
        subtitle="Better QS rank to the right. Sri Lankan universities are placed at the midpoint of their published QS 2027 band."
      >
        <Chart
          option={scatter}
          height={430}
          label="Scatter of QS 2027 position against university median"
        />
      </Card>
      <Card
        title="Benchmark universities"
        subtitle="Universities chosen from QS 2027, with sampled departments and coverage. Substitutions are explained under Data & Methodology."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>University</th>
                <th>Country</th>
                <th>Tier</th>
                <th>QS 2027</th>
                <th>Sampled</th>
                <th>With values</th>
                <th>Median {metricNames[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((u) => (
                <tr key={u.country + u.id}>
                  <td>{u.label}</td>
                  <td>{u.country}</td>
                  <td>{u.tier === "sl" ? "Sri Lanka" : u.tier}</td>
                  <td>{u.qs}</td>
                  <td>{u.n}</td>
                  <td>{u.values.length}</td>
                  <td>{fmt(median(u.values), 1)}</td>
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
            Each country has two elite universities (the top two in the country
            with an accessible official staff directory), two middle-tier
            universities (QS ~420–560) and two lower-tier universities (QS
            ~800–1200, the band of the University of Colombo). Australia has one
            lower-tier university: the others in that band block automated
            access.
          </li>
          <li>
            Departments are matched to Sri Lankan strengths: Computer Science
            and Physics, or the nearest unit where Physics does not exist.
            Rosters come from official directories, with visiting, adjunct,
            courtesy and emeritus staff excluded. Departments larger than 25 are
            sampled systematically in directory order.
          </li>
          <li>
            Research metrics come from OpenAlex, matched by name within the
            university's OpenAlex institution. Ambiguous names (two plausible
            profiles) are left blank, not guessed. Missing values are excluded,
            never treated as zero.
          </li>
          <li>
            Elite directories mostly list tenure-track professors, while Sri
            Lankan lists include lecturers and probationary staff. Compare
            matching positions where that matters.
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

/** Compact Overview card: Sri Lankan median h-index against the three tiers. */
export function GlobalTeaser() {
  const d = useData();
  const theme = useAtlas((s) => s.theme);
  const col = palette[theme];
  const [b, setB] = useState<Benchmarks | null>(null);
  useEffect(() => {
    loadBenchmarks().then(setB, () => setB(null));
  }, []);
  if (!b) return null;
  const sl = values(
    d.academics.filter((a) => matchedField(a)).map((a) => a.hIndex),
  );
  const bars = [
    { label: "Sri Lanka", key: "sl" as const, v: sl },
    ...[...TIERS].reverse().map((t) => ({
      label: tierLabels[t],
      key: t,
      v: values(b.academics.filter((a) => a.tier === t).map((a) => a.hIndex)),
    })),
  ];
  return (
    <Card
      title="How Sri Lanka compares internationally"
      subtitle="Median h-index in Computer Science and Physics: Sri Lanka (collected profiles) against QS 2027 tiers in seven countries (OpenAlex)."
      action={
        <Link className="text-link" to="/global">
          Open Global Benchmarks
        </Link>
      }
    >
      <Chart
        height={260}
        label="Median h-index for Sri Lanka and the three international tiers"
        option={{
          tooltip: { trigger: "item", confine: true },
          grid: {
            left: 10,
            right: 60,
            top: 10,
            bottom: 10,
            containLabel: true,
          },
          xAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.35 } } },
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
