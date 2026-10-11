import type {
  Academic,
  Config,
  CustomGroup,
  Metric,
  NumericMetric,
} from "../types";
import { aggregate, compare, groupKey, summary, values } from "./engine";
import { metricLabels } from "../types";
import { colors, short } from "../components/common";
export function comparisonChart(
  rows: Academic[],
  c: Config,
  pinned: Academic[],
  custom: CustomGroup[],
) {
  const groups = compare(rows, c, custom);
  const labels = groups.map((g) => short(g.label));
  const numeric = !["count", "phd", "overseas"].includes(c.metric);
  const metric = c.metric as NumericMetric;
  const base: any = {
    tooltip: { trigger: "item", renderMode: "richText", confine: true },
    grid: { left: 65, right: 35, top: 55, bottom: 100 },
    legend: { top: 5, type: "scroll", textStyle: { fontSize: 14 } },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        fontSize: 14,
        interval: "auto",
        rotate: labels.length > 5 ? 35 : 0,
        width: 125,
        overflow: "truncate",
      },
    },
    yAxis: {
      type: c.log ? "log" : "value",
      name:
        c.metric === "experience"
          ? "Years"
          : ["phd", "overseas"].includes(c.metric)
            ? "Percent"
            : "Value",
      nameTextStyle: { fontSize: 14 },
      axisLabel: { fontSize: 14 },
    },
    dataZoom: [{ type: "slider", bottom: 15, height: 20 }, { type: "inside" }],
  };
  const pinSeries = (kind: "scatter" | "box") =>
    pinned
      .filter((a) => a[metric] !== null && (!c.log || a[metric]! > 0))
      .map((a) => {
        const i = pinned.findIndex((p) => p.id === a.id);
        const groupIndex = groups.findIndex((g) =>
          g.rows.some((r) => r.id === a.id),
        );
        const idx =
          groupIndex >= 0
            ? groupIndex
            : groups.findIndex((g) => g.id === groupKey(a, c.level));
        return {
          name: a.name + (groupIndex < 0 ? " (external)" : ""),
          type: "scatter",
          symbol: ["circle", "diamond", "triangle", "rect"][i % 4],
          symbolSize: 15,
          itemStyle: {
            color: colors[i % colors.length],
            borderColor: "#fff",
            borderWidth: 2,
          },
          z: 10,
          data:
            kind === "scatter"
              ? a[c.xMetric] === null || (c.log && a[c.xMetric]! <= 0)
                ? []
                : [
                    {
                      name: a.name,
                      value: [a[c.xMetric], a[metric]],
                      academicId: a.id,
                    },
                  ]
              : idx < 0
                ? []
                : [[idx, a[metric]]],
        };
      });
  if ((c.chart === "scatter" || c.chart === "bubble") && numeric) {
    return {
      ...base,
      xAxis: {
        type: c.log ? "log" : "value",
        name: metricLabels[c.xMetric],
        nameLocation: "middle",
        nameGap: 35,
        axisLabel: { fontSize: 14 },
      },
      yAxis: { ...base.yAxis, name: metricLabels[metric] },
      series: [
        ...groups.map((g, i) => ({
          name: short(g.label),
          type: "scatter",
          symbolSize:
            c.chart === "bubble"
              ? (v: number[]) =>
                  Math.max(6, Math.min(36, Math.sqrt(v[2] || 0) * 2))
              : 8,
          itemStyle: { color: colors[i % colors.length], opacity: 0.55 },
          data: g.rows
            .filter(
              (a) =>
                a[c.xMetric] !== null &&
                a[metric] !== null &&
                (c.chart !== "bubble" || a.hIndex !== null) &&
                (!c.log || (a[c.xMetric]! > 0 && a[metric]! > 0)),
            )
            .map((a) => ({
              name: a.name,
              value: [a[c.xMetric], a[metric], a.hIndex],
              academicId: a.id,
            })),
        })),
        ...pinSeries("scatter"),
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        { type: "inside", yAxisIndex: 0 },
        { type: "slider", xAxisIndex: 0, bottom: 15 },
      ],
    };
  }
  if (c.chart === "box" && numeric) {
    return {
      ...base,
      series: [
        {
          name: "Individual distribution",
          type: "boxplot",
          data: groups.map((g) => {
            const s = summary(g.distribution);
            return s.n
              ? [s.min, s.q1, s.median, s.q3, s.max]
              : { value: [null, null, null, null, null] };
          }),
          itemStyle: { color: "#e2edf6", borderColor: "#2675b9" },
          tooltip: { renderMode: "richText" },
        },
        ...pinSeries("box"),
      ],
    };
  }
  if (c.chart === "histogram" && numeric) {
    const all = values(groups.flatMap((g) => g.distribution));
    if (!all.length) return { ...base, series: [] };
    const min = all.length ? Math.min(...all) : 0,
      max = all.length ? Math.max(...all) : 0,
      width = Math.max(1, (max - min) / 12);
    const bins = Array.from({ length: 12 }, (_, i) => min + width * i);
    return {
      ...base,
      xAxis: {
        type: "value",
        name: metricLabels[metric],
        axisLabel: { fontSize: 14 },
      },
      yAxis: {
        type: "value",
        name: "Valid profiles",
        axisLabel: { fontSize: 14 },
      },
      series: groups
        .filter((g) => g.distribution.length)
        .map((g, i) => ({
          name: short(g.label),
          type: "bar",
          barWidth: "85%",
          itemStyle: { color: colors[i % colors.length], opacity: 0.65 },
          data: bins.map((lo, j) => [
            lo + width / 2,
            g.distribution.filter(
              (v) => v >= lo && (j === 11 ? true : v < lo + width),
            ).length,
          ]),
          markLine:
            i === 0
              ? {
                  symbol: "none",
                  data: pinned
                    .filter((a) => a[metric] !== null)
                    .map((a) => ({
                      name: a.name,
                      xAxis: a[metric],
                      lineStyle: {
                        color:
                          colors[
                            pinned.findIndex((p) => p.id === a.id) %
                              colors.length
                          ],
                        width: 2,
                      },
                      label: { formatter: a.name, fontSize: 14, rotate: 90 },
                    })),
                }
              : undefined,
        })),
      dataZoom: [],
    };
  }
  if (c.chart === "heatmap") {
    const metrics: Metric[] = numeric
      ? [
          "publications",
          "citations",
          "recentCitations",
          "hIndex",
          "q1",
          "recentQ1",
        ]
      : ["count", "phd", "overseas"];
    const cells = metrics.flatMap((m, x) => {
      const mode = ["count", "phd", "overseas"].includes(m)
        ? m === "count"
          ? "total"
          : "percentage"
        : m === "hIndex" && ["total", "per10"].includes(c.aggregation)
          ? "median"
          : c.aggregation;
      const calculated = compare(
        rows,
        { ...c, metric: m, aggregation: mode },
        custom,
      );
      const stats = groups.map((g) => calculated.find((s) => s.id === g.id));
      const vals = stats.map((s) => s?.value ?? null);
      const finite = values(vals),
        max = Math.max(1, ...finite);
      return vals.flatMap((v, y) =>
        v === null
          ? []
          : [
              {
                value: [x, y, (v / max) * 100],
                actual: v,
                n: stats[y]?.n ?? 0,
              },
            ],
      );
    });
    return {
      ...base,
      grid: { left: 150, right: 70, top: 40, bottom: 100 },
      xAxis: {
        type: "category",
        data: metrics.map((m) => metricLabels[m]),
        axisLabel: { fontSize: 14, rotate: 25 },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontSize: 14, width: 130, overflow: "truncate" },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 5,
        inRange: { color: ["#ecf2f7", "#237db4"] },
      },
      series: [
        {
          type: "heatmap",
          data: cells,
          label: {
            show: true,
            fontSize: 14,
            formatter: (p: any) => Math.round(p.data.actual).toLocaleString(),
          },
          tooltip: {
            formatter: (p: any) =>
              `${labels[p.value[1]]}\n${metricLabels[metrics[p.value[0]]]}: ${p.data.actual.toFixed(1)}\nValid n = ${p.data.n}\nColour normalised within each metric`,
          },
        },
      ],
      dataZoom: [],
    };
  }
  if (c.chart === "treemap")
    return {
      tooltip: { renderMode: "richText" },
      series: [
        {
          type: "treemap",
          roam: true,
          label: { fontSize: 16, formatter: "{b}\n{c}" },
          data: groups
            .filter((g) => g.value !== null && g.value > 0)
            .map((g, i) => ({
              name: short(g.label),
              value: g.value,
              groupId: g.id,
              itemStyle: { color: colors[i % colors.length] },
            })),
        },
      ],
    };
  if (["stacked", "percentStacked", "grouped"].includes(c.chart)) {
    const categories = [
      ...new Set(
        rows.map((a) =>
          c.level === "rank" || c.level === "qualification"
            ? a.qualification
            : a.rank,
        ),
      ),
    ];
    return {
      ...base,
      yAxis: {
        ...base.yAxis,
        type: "value",
        name:
          c.chart === "percentStacked"
            ? "Percent of group"
            : "Academic records",
      },
      series: categories.map((rank, i) => ({
        name: rank,
        type: "bar",
        stack: c.chart === "grouped" ? undefined : "composition",
        itemStyle: { color: colors[i % colors.length] },
        label: { show: c.labels, fontSize: 14 },
        data: groups.map((g) => {
          const n = g.rows.filter(
            (a) =>
              (c.level === "rank" || c.level === "qualification"
                ? a.qualification
                : a.rank) === rank,
          ).length;
          return {
            value:
              c.chart === "percentStacked"
                ? g.rows.length
                  ? (100 * n) / g.rows.length
                  : 0
                : n,
            n: g.rows.length,
          };
        }),
      })),
    };
  }
  return {
    ...base,
    series: [
      {
        name:
          c.weight === "equal" && c.level === "type"
            ? "Mean of university statistics"
            : c.aggregation,
        type: "bar",
        barMaxWidth: 52,
        itemStyle: { borderRadius: [5, 5, 0, 0] },
        label: { show: c.labels, position: "top", fontSize: 14 },
        data: groups.map((g, i) => ({
          name: labels[i],
          value: g.value,
          groupId: g.id,
          itemStyle: {
            color:
              c.level === "type"
                ? g.id === "Public"
                  ? "#2675b9"
                  : "#169688"
                : colors[i % colors.length],
          },
          n: g.n,
        })),
        tooltip: {
          formatter: (p: any) =>
            `${p.name}\n${c.aggregation}: ${p.value === null ? "Not available" : Number(p.value).toLocaleString()}\nValid records: ${p.data.n}\n${c.weight === "equal" && c.level === "type" ? "Each university contributes equally" : ""}`,
        },
      },
    ],
  };
}
