import { useMemo, useState } from "react";
import { Award, Globe2, MapPin } from "lucide-react";
import type { Academic, NumericMetric } from "../types";
import { Card, fmt } from "./common";
import { Chart } from "./Chart";
import { Select } from "./ui/select";
import { withProvider } from "../analytics/quality";
import {
  QS_BANDS,
  SENIORITY,
  groupStats,
  qsBandOf,
  qsNumber,
  seniorityBand,
  type GroupStat,
  type Seniority,
  type Statistic,
} from "../analytics/phd-impact";

type Tab = "origin" | "country" | "qs";
type Palette = { lk: string; overseas: string; unknown: string };

const MEASURES: [NumericMetric, string][] = [
  ["hIndex", "h-index"],
  ["citations", "Citations"],
  ["recentCitations", "Citations 2021–2025"],
  ["publications", "Publications"],
];
const MIX_COLORS = ["#c7d2fe", "#6f86e8", "#1f2d8f"];
const BAND_COLORS: Record<string, string> = {
  "Top 100": "#1f2d8f",
  "101–250": "#3b4fd6",
  "251–500": "#6f86e8",
  "501–1000": "#a5b4f5",
  "1001+": "#cdd6fb",
  "Not ranked": "#9aa8b5",
};

const hatch = {
  symbol: "rect",
  dashArrayX: [1, 0],
  dashArrayY: [3, 3],
  rotation: -Math.PI / 4,
  color: "rgba(255,255,255,.6)",
};

/**
 * Does the place a doctorate was earned go with differences in research output?
 * Descriptive only: one provider (Google Scholar), minimum sample per group, position controlled for.
 */
export function PhdImpact({ documented, minN, col }: { documented: Academic[]; minN: number; col: Palette }) {
  const [tab, setTab] = useState<Tab>("origin");
  const [metric, setMetric] = useState<NumericMetric>("hIndex");
  const [statistic, setStatistic] = useState<Statistic>("median");
  const [position, setPosition] = useState<"all" | Seniority>("all");
  const [qsView, setQsView] = useState<"bands" | "universities">("bands");
  const measure = MEASURES.find(([k]) => k === metric)![1];
  const statName = statistic === "median" ? "Median" : "Mean";

  const scholar = useMemo(() => withProvider(documented, "Google Scholar").rows, [documented]);
  const rows = useMemo(
    () => (position === "all" ? scholar : scholar.filter((a) => seniorityBand(a.rank) === position)),
    [scholar, position],
  );
  const stats = (keyFn: (a: Academic) => string | null, from = rows) => groupStats(from, keyFn, metric, statistic, minN);

  const originKey = (a: Academic) => (a.phdCountry === "Sri Lanka" ? "Sri Lanka" : a.phdCountry ? "Overseas" : null);
  const origin = stats(originKey).sort((a, b) => (a.label === "Sri Lanka" ? -1 : b.label === "Sri Lanka" ? 1 : 0));
  const byPosition = SENIORITY.map((s) => ({
    position: s,
    groups: stats(originKey, scholar.filter((a) => seniorityBand(a.rank) === s)),
  }));
  const countries = stats((a) => a.phdCountry || null)
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label))
    .slice(0, 14);
  const bands = stats((a) => qsBandOf(a)).sort((a, b) => QS_BANDS.indexOf(a.label as never) - QS_BANDS.indexOf(b.label as never));
  const values = (a: Academic) => a[metric];
  const allVals = rows.map(values).filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((x, y) => x - y);
  const overallMedian = allVals.length ? (allVals[Math.floor((allVals.length - 1) / 2)] + allVals[Math.ceil((allVals.length - 1) / 2)]) / 2 : null;
  const shareAbove = origin.map((g) => {
    const vs = rows.filter((a) => originKey(a) === g.label).map(values).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return { g, share: vs.length && overallMedian !== null ? (100 * vs.filter((v) => v > overallMedian).length) / vs.length : null };
  });
  const unlocated = rows.filter((a) => a.phdUniversity && qsBandOf(a) === null).length;
  const noUniversity = rows.filter((a) => !a.phdUniversity).length;

  const colorOf = (g: GroupStat) =>
    tab === "origin" || tab === "country"
      ? g.label === "Sri Lanka"
        ? col.lk
        : col.overseas
      : BAND_COLORS[g.label] ?? col.unknown;

  const tip = (g: GroupStat) =>
    `${g.label}<br/>${statName} ${measure}: <b>${g.value === null ? "—" : fmt(g.value, 1)}</b><br/>Median ${g.median === null ? "—" : fmt(g.median, 1)} · Mean ${g.mean === null ? "—" : fmt(g.mean, 1)}<br/>Middle 50%: ${g.q1 === null ? "—" : fmt(g.q1, 1)} to ${g.q3 === null ? "—" : fmt(g.q3, 1)}<br/>${g.n} with a value of ${g.people} people${g.lowN ? `<br/><i>Fewer than ${minN} values: indicative only</i>` : ""}`;

  const barOption = (groups: GroupStat[]) => ({
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => tip(groups[p.dataIndex]) },
    grid: { left: 8, right: 70, top: 10, bottom: 24, containLabel: true },
    xAxis: { type: "value", name: `${statName} ${measure}`, nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: {
      type: "category",
      inverse: true,
      data: groups.map((g) => `${g.label}\nn=${g.n}`),
      axisLabel: { fontSize: 13, lineHeight: 16, width: 140, overflow: "break" },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 34,
        data: groups.map((g) => ({
          value: g.value,
          itemStyle: { color: colorOf(g), opacity: g.lowN ? 0.55 : 1, decal: g.lowN ? hatch : undefined },
        })),
        label: { show: true, position: "right", fontSize: 13, formatter: (p: any) => (p.value === null || p.value === undefined ? "—" : fmt(p.value, 1)) },
      },
    ],
  });

  const mixOption = (groups: GroupStat[]) => ({
    tooltip: { trigger: "item", confine: true, valueFormatter: (v: number) => fmt(v, 0) + "%" },
    legend: { show: false },
    grid: { left: 8, right: 16, top: 10, bottom: 24, containLabel: true },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { opacity: 0.3 } } },
    yAxis: {
      type: "category",
      inverse: true,
      data: groups.map((g) => `${g.label}\nn=${Object.values(g.mix).reduce((s, v) => s + v, 0)}`),
      axisLabel: { fontSize: 13, lineHeight: 16, width: 140, overflow: "break" },
    },
    series: SENIORITY.map((s, i) => ({
      type: "bar",
      name: s,
      stack: "mix",
      barMaxWidth: 34,
      itemStyle: { color: MIX_COLORS[i] },
      label: { show: true, color: i === 0 ? "#18203a" : "#fff", formatter: (p: any) => (p.value >= 9 ? Math.round(p.value) + "%" : "") },
      data: groups.map((g) => {
        const total = Object.values(g.mix).reduce((x, y) => x + y, 0);
        return total ? (100 * g.mix[s]) / total : 0;
      }),
    })),
  });

  const positionOption = {
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => tip(byPosition[p.dataIndex].groups.find((g) => g.label === p.seriesName)!) },
    legend: { top: 0, icon: "roundRect" },
    grid: { left: 8, right: 16, top: 34, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: SENIORITY as unknown as string[], axisLabel: { fontSize: 13 } },
    yAxis: { type: "value", name: `${statName} ${measure}`, nameLocation: "middle", nameGap: 40, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: ["Sri Lanka", "Overseas"].map((label) => ({
      type: "bar",
      name: label,
      barMaxWidth: 46,
      itemStyle: { color: label === "Sri Lanka" ? col.lk : col.overseas },
      label: { show: true, position: "top", fontSize: 12, formatter: (p: any) => (p.value === null || p.value === undefined ? "" : fmt(p.value, 1)) },
      data: byPosition.map((b) => {
        const g = b.groups.find((x) => x.label === label);
        return { value: g?.value ?? null, itemStyle: { opacity: g && g.lowN ? 0.5 : 1, decal: g && g.lowN ? hatch : undefined } };
      }),
    })),
  };

  const universities = useMemo(() => {
    const byInstitution = new Map<string, Academic[]>();
    for (const a of rows) {
      const n = qsNumber(a.phdQsRank);
      if (a.phdQsStatus !== "ranked" || n === null || !a.phdInstitution) continue;
      if (!byInstitution.has(a.phdInstitution)) byInstitution.set(a.phdInstitution, []);
      byInstitution.get(a.phdInstitution)!.push(a);
    }
    return [...byInstitution]
      .map(([institution, members]) => {
        const g = groupStats(members, () => institution, metric, statistic, minN)[0];
        return { institution, rank: qsNumber(members[0].phdQsRank)!, text: members[0].phdQsRank!, sl: members[0].phdCountry === "Sri Lanka", g };
      })
      .filter((u) => u.g.n >= 3 && u.g.value !== null);
  }, [rows, metric, statistic, minN]);

  const scatterOption = {
    tooltip: {
      confine: true,
      formatter: (p: any) => {
        const u = universities[p.data.value[4]];
        return `${u.institution}<br/>QS 2027: ${u.text}<br/>${statName} ${measure}: <b>${fmt(u.g.value!, 1)}</b><br/>${u.g.n} people with a value${u.g.lowN ? "<br/><i>Indicative only</i>" : ""}`;
      },
    },
    grid: { left: 10, right: 24, top: 20, bottom: 56, containLabel: true },
    xAxis: {
      type: "log",
      inverse: true,
      min: 1,
      max: 2000,
      name: "QS 2027 world rank (log scale; better rank on the right)",
      nameLocation: "middle",
      nameGap: 34,
      axisLabel: { formatter: (v: number) => (v >= 1 ? String(v) : "") },
      splitLine: { lineStyle: { opacity: 0.25 } },
    },
    yAxis: { type: "value", name: `${statName} ${measure}`, nameLocation: "middle", nameGap: 42, min: 0, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: [
      {
        type: "scatter",
        data: universities.map((u, i) => ({
          value: [u.rank, u.g.value, u.g.n, u.institution, i],
          symbolSize: Math.min(40, 9 + 5 * Math.sqrt(u.g.n)),
          itemStyle: { color: u.sl ? col.lk : col.overseas, opacity: u.g.lowN ? 0.45 : 0.9, borderColor: "#fff", borderWidth: 1.5 },
          label: { show: u.g.n >= 8, position: "top", fontSize: 11, formatter: () => u.institution.replace(/^(The )?University of /, "").replace(/ University$/, "") },
        })),
      },
    ],
  };

  const tabs: [Tab, string, typeof Globe2][] = [
    ["origin", "Sri Lanka vs overseas", MapPin],
    ["country", "By country", Globe2],
    ["qs", "By university ranking (QS 2027)", Award],
  ];
  const main = tab === "origin" ? origin : tab === "country" ? countries : bands;
  const chartH = Math.max(220, main.length * 52 + 70);
  const oLabels = origin.map((g) => g.label);
  const axisY = { type: "category", inverse: true, data: oLabels, axisLabel: { fontSize: 13, width: 140, overflow: "break" } };

  const spreadOption = {
    tooltip: { trigger: "item", confine: true, formatter: (p: any) => tip(origin[p.dataIndex]) },
    grid: { left: 8, right: 24, top: 10, bottom: 34, containLabel: true },
    xAxis: { type: "value", name: `${measure}: middle 50% of people (white line = median)`, nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: axisY,
    series: [
      { type: "bar", stack: "r", silent: true, itemStyle: { color: "transparent" }, data: origin.map((g) => g.q1 ?? 0) },
      {
        type: "bar",
        stack: "r",
        barMaxWidth: 34,
        data: origin.map((g) => ({
          value: g.q1 === null || g.q3 === null ? null : g.q3 - g.q1,
          itemStyle: { color: colorOf(g), opacity: g.lowN ? 0.5 : 0.9, decal: g.lowN ? hatch : undefined },
        })),
      },
    ],
  };

  const shareOption = {
    tooltip: { trigger: "item", confine: true, valueFormatter: (v: number) => fmt(v, 0) + "%" },
    grid: { left: 8, right: 56, top: 10, bottom: 34, containLabel: true },
    xAxis: { type: "value", max: 100, name: `Share above the overall median (${overallMedian === null ? "—" : fmt(overallMedian, 1)})`, nameLocation: "middle", nameGap: 28, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { opacity: 0.35 } } },
    yAxis: axisY,
    series: [
      {
        type: "bar",
        barMaxWidth: 34,
        data: shareAbove.map(({ g, share }) => ({ value: share, itemStyle: { color: colorOf(g), opacity: g.lowN ? 0.5 : 1, decal: g.lowN ? hatch : undefined } })),
        label: { show: true, position: "right", fontSize: 13, formatter: (p: any) => (p.value === null || p.value === undefined ? "—" : Math.round(p.value) + "%") },
      },
    ],
  };

  const coverageOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
    legend: { top: 0, icon: "roundRect" },
    grid: { left: 8, right: 16, top: 34, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: oLabels, axisLabel: { fontSize: 13 } },
    yAxis: { type: "value", name: "People", nameLocation: "middle", nameGap: 40, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: [
      { type: "bar", name: `With ${measure}`, stack: "c", barMaxWidth: 60, itemStyle: { color: col.lk }, data: origin.map((g) => g.n) },
      { type: "bar", name: "No value on file", stack: "c", barMaxWidth: 60, itemStyle: { color: col.unknown }, data: origin.map((g) => g.people - g.n) },
    ],
  };

  return (
    <Card
      title="Does where the doctorate was earned matter?"
      subtitle="Research output of academics grouped by where, and at which ranked university, they earned their PhD. Descriptive associations from Google Scholar figures, not causes."
      className="phd-impact"
    >
      <div className="impact-tabs" role="tablist" aria-label="Comparison view">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="impact-controls">
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
        <label className="field">
          Position
          <Select aria-label="Position" value={position} onChange={(e) => setPosition(e.target.value as "all" | Seniority)}>
            <option value="all">All positions</option>
            {SENIORITY.map((s) => (
              <option key={s} value={s}>{s} only</option>
            ))}
          </Select>
        </label>
        {tab === "qs" && (
          <div className="field">
            <span>Show</span>
            <div className="chip-group" role="group" aria-label="Ranking view">
              {([["bands", "Rank bands"], ["universities", "Each university"]] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={qsView === k} onClick={() => setQsView(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {tab === "qs" && qsView === "universities" ? (
        <div>
          <h3 className="pos-sub">{measure} by awarding university and its QS 2027 rank</h3>
          <Chart option={scatterOption} height={420} label="Scatter plot of each awarding university's QS 2027 rank against its academics' research output" />
          <div className="benchmark-key">
            <span><i style={{ background: col.lk }} />Sri Lankan university</span>
            <span><i style={{ background: col.overseas }} />Overseas university</span>
            <span>Bubble size = people with a value; faded = fewer than {minN}</span>
          </div>
        </div>
      ) : (
        <div className="pos-grid">
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">{statName} {measure}</h3></div>
            <Chart option={barOption(main)} height={chartH} label={`${statName} ${measure} by group`} />
          </div>
          <div className="pos-col">
            <div className="pos-head">
              <h3 className="pos-sub">Positions in each group</h3>
              <ul className="pos-key pos-key-row" aria-label="Positions">
                {SENIORITY.map((s, i) => (
                  <li key={s}><i style={{ background: MIX_COLORS[i] }} /><span><b>{s}</b></span></li>
                ))}
              </ul>
            </div>
            <Chart option={mixOption(main)} height={chartH} label="Share of lecturers, senior lecturers and professors in each group" />
          </div>
        </div>
      )}
      {tab === "origin" && (
        <div className="pos-grid pos-grid-even">
          {position === "all" && (
            <div className="pos-col">
              <div className="pos-head"><h3 className="pos-sub">Same position, different origin</h3></div>
              <Chart option={positionOption} height={300} label={`${statName} ${measure} by position for Sri Lankan and overseas PhDs`} />
            </div>
          )}
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">Spread within each group</h3></div>
            <Chart option={spreadOption as any} height={300} label={`Middle half of ${measure} in each group`} />
          </div>
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">Share above the overall median</h3></div>
            <Chart option={shareOption} height={300} label={`Share of each group above the overall median ${measure}`} />
          </div>
          <div className="pos-col">
            <div className="pos-head"><h3 className="pos-sub">People behind each group</h3></div>
            <Chart option={coverageOption} height={300} label="People with and without a value in each group" />
          </div>
        </div>
      )}
      <p className="caption">
        One provider only (Google Scholar); people without a value are not counted, never treated as zero. Groups with fewer than {minN} values are hatched and indicative.
        {tab === "qs" && unlocated + noUniversity > 0
          ? ` Left out: ${unlocated.toLocaleString()} whose awarding university has no QS 2027 rank located${noUniversity ? ` and ${noUniversity.toLocaleString()} with no awarding university recorded` : ""}.`
          : ""}
        {position !== "all" ? ` Showing ${position.toLowerCase()}s only (${rows.length.toLocaleString()} of ${scholar.length.toLocaleString()}).` : ""}
      </p>
    </Card>
  );
}
