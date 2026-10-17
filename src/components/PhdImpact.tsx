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

  const insight = (() => {
    if (tab === "origin") {
      const sl = origin.find((g) => g.label === "Sri Lanka"),
        ov = origin.find((g) => g.label === "Overseas");
      if (!sl || !ov || sl.value === null || ov.value === null)
        return `Not enough ${measure} values in both groups for this selection (at least ${minN} each are needed).`;
      const within = byPosition
        .map((b) => ({ p: b.position, s: b.groups.find((g) => g.label === "Sri Lanka"), o: b.groups.find((g) => g.label === "Overseas") }))
        .filter((x) => x.s && x.o && !x.s.lowN && !x.o.lowN && x.s.value !== null && x.o.value !== null);
      const higher = within.filter((x) => x.o!.value! > x.s!.value!).length;
      return `${statName} ${measure}: ${fmt(ov.value, 1)} for academics with an overseas PhD (n=${ov.n}) and ${fmt(sl.value, 1)} for Sri Lankan PhDs (n=${sl.n}).${
        within.length && position === "all"
          ? ` Within the same position, the overseas group is higher in ${higher} of ${within.length} positions with enough data.`
          : ""
      }`;
    }
    if (tab === "country") {
      const ok = countries.filter((g) => !g.lowN && g.value !== null).sort((a, b) => b.value! - a.value!);
      return ok.length
        ? `Highest ${statName.toLowerCase()} ${measure} among countries with ${minN}+ values: ${ok[0].label} (${fmt(ok[0].value, 1)}, n=${ok[0].n})${ok.length > 1 ? `; lowest: ${ok[ok.length - 1].label} (${fmt(ok[ok.length - 1].value, 1)}, n=${ok[ok.length - 1].n})` : ""}.`
        : `No country has ${minN}+ values for this selection; bars shown are indicative.`;
    }
    const ok = bands.filter((g) => !g.lowN && g.value !== null && g.label !== "Not ranked");
    return ok.length > 1
      ? `${statName} ${measure} runs from ${fmt(ok[0].value!, 1)} (${ok[0].label}, n=${ok[0].n}) to ${fmt(ok[ok.length - 1].value!, 1)} (${ok[ok.length - 1].label}, n=${ok[ok.length - 1].n}) across QS 2027 bands with ${minN}+ values.`
      : `Too few ranked groups with ${minN}+ values for this selection.`;
  })();

  const tabs: [Tab, string, typeof Globe2][] = [
    ["origin", "Sri Lanka vs overseas", MapPin],
    ["country", "By country", Globe2],
    ["qs", "By university ranking (QS 2027)", Award],
  ];
  const main = tab === "origin" ? origin : tab === "country" ? countries : bands;

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
      <p className="pos-insight">{insight}</p>
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
            <h3 className="pos-sub">{statName} {measure}</h3>
            <Chart option={barOption(main)} height={Math.max(220, main.length * 52 + 70)} label={`${statName} ${measure} by group`} />
          </div>
          <div className="pos-col">
            <h3 className="pos-sub">Positions in each group</h3>
            <Chart option={mixOption(main)} height={Math.max(220, main.length * 52 + 70)} label="Share of lecturers, senior lecturers and professors in each group" />
            <ul className="pos-key pos-key-row" aria-label="Positions">
              {SENIORITY.map((s, i) => (
                <li key={s}><i style={{ background: MIX_COLORS[i] }} /><span><b>{s}</b></span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {tab === "origin" && position === "all" && (
        <div className="impact-within">
          <h3 className="pos-sub">Same position, different origin</h3>
          <Chart option={positionOption} height={300} label={`${statName} ${measure} by position for Sri Lankan and overseas PhDs`} />
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
