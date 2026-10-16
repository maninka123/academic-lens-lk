import type {
  Academic,
  Config,
  CustomGroup,
  Metric,
  NumericMetric,
} from "../types";
import { compare, groupKey, percentile, summary, values } from "./engine";
import { metricLabels } from "../types";
import { aheadOf, colors, personColors, short, standingColor } from "../components/common";
import { plotNumber } from "./plot-format";
import { heatDatum, heatVisualMap } from "./heatmap";
export function comparisonChart(
  rows: Academic[],
  c: Config,
  pinned: Academic[],
  custom: CustomGroup[],
  /** Pinned people whose value comes from another provider: id -> provider. */
  otherProvider: Map<string, string> = new Map(),
) {
  const groups = compare(rows, c, custom);
  const labels = groups.map((g) => short(g.label));
  const numeric = !["count", "phd", "overseas"].includes(c.metric);
  const metric = c.metric as NumericMetric;
  const barReferences = numeric && ["median", "mean", "distribution"].includes(c.aggregation)
    ? pinned.filter((a) => Number.isFinite(a[metric]) && (!c.log || a[metric]! > 0))
    : [];
  const referenceValues = [...new Set(barReferences.map((a) => a[metric]!))];
  const base: any = {
    tooltip: { trigger: "item", renderMode: "richText", confine: true },
    grid: { left: 75, right: 32, top: 85, bottom: 85, containLabel: true },
    legend: {
      top: 5,
      left: 10,
      right: 10,
      type: "scroll",
      textStyle: { fontSize: 14, width: 160, overflow: "truncate" },
      tooltip: { show: true },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        fontSize: 14,
        interval: 0,
        rotate: labels.length > 5 ? 35 : 0,
        width: 125,
        overflow: "break",
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
      nameLocation: "middle",
      nameGap: 50,
      nameTextStyle: { fontSize: 14 },
      axisLabel: { fontSize: 14 },
    },
    dataZoom: [
      {
        type: "slider",
        bottom: 15,
        height: 20,
        startValue: 0,
        endValue: Math.min(11, labels.length - 1),
      },
      { type: "inside" },
    ],
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
            color: personColors[i % personColors.length],
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
          itemStyle: { color: "#e2edf6", borderColor: "#3b4fd6" },
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
                          personColors[
                            pinned.findIndex((p) => p.id === a.id) %
                              personColors.length
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
          : [heatDatum(x, y, (v / max) * 100, { actual: v, n: stats[y]?.n ?? 0 })],
      );
    });
    return {
      ...base,
      grid: { left: 20, right: 25, top: 30, bottom: 75, containLabel: true },
      xAxis: {
        type: "category",
        data: metrics.map((m) => metricLabels[m]),
        axisLabel: {
          fontSize: 14,
          interval: 0,
          width: 120,
          overflow: "break",
          rotate: 0,
        },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontSize: 14, width: 200, overflow: "break" },
      },
      visualMap: heatVisualMap(100, ["Highest in column", "Lowest"]),
      series: [
        {
          type: "heatmap",
          data: cells,
          label: {
            show: true,
            fontSize: 13,
            formatter: (p: any) => plotNumber(p.data.actual),
          },
          tooltip: {
            formatter: (p: any) =>
              `${labels[p.value[1]]}\n${metricLabels[metrics[p.value[0]]]}: ${plotNumber(p.data.actual, 1)}\nValid records: ${p.data.n}\nShade is relative to the highest value in this column`,
          },
        },
      ],
      dataZoom:
        labels.length > 15
          ? [
              {
                type: "slider",
                yAxisIndex: 0,
                right: 0,
                width: 14,
                startValue: 0,
                endValue: 14,
              },
            ]
          : [],
    };
  }
  if (c.chart === "treemap")
    return {
      tooltip: { renderMode: "richText" },
      series: [
        {
          type: "treemap",
          roam: true,
          label: {
            fontSize: 16,
            formatter: (p: any) => `${p.name}\n${plotNumber(p.value)}`,
          },
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
    ].sort((a, b) => {
      const order = c.level === "rank" || c.level === "qualification"
        ? ["PhD", "Masters / MPhil", "Bachelors", "Other documented", "Unknown"]
        : ["Senior Professor", "Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer", "Lecturer", "Assistant Lecturer", "Instructor", "Librarian", "Other", "Unknown"];
      const index = (value: string) => { const i = order.indexOf(value); return i < 0 ? order.length - 1 : i; };
      return index(a) - index(b) || a.localeCompare(b);
    });
    const percent = c.chart === "percentStacked";
    const crowded = groups.length > 10;
    return {
      ...base,
      // Plain legend that wraps onto as many rows as it needs: nothing is cut off.
      legend: {
        data: categories,
        type: "plain",
        top: 0,
        left: 0,
        right: 0,
        itemGap: 18,
        itemWidth: 16,
        itemHeight: 10,
        textStyle: { fontSize: 13 },
      },
      grid: { left: 70, right: 24, top: 96, bottom: crowded ? 80 : 50, containLabel: true },
      xAxis: {
        ...base.xAxis,
        axisLabel: { ...base.xAxis.axisLabel, rotate: groups.length > 6 ? 35 : 0, width: 100, overflow: "truncate" },
      },
      yAxis: {
        ...base.yAxis,
        type: "value",
        max: percent ? 100 : undefined,
        name: percent ? "Percent of group" : "Academic records",
      },
      dataZoom: crowded
        ? [{ type: "slider", bottom: 12, height: 18, startValue: 0, endValue: 11 }, { type: "inside" }]
        : [],
      tooltip: {
        trigger: "item",
        renderMode: "richText",
        confine: true,
        formatter: (p: any) =>
          `${p.name}\n${p.seriesName}: ${plotNumber(p.data.count)} (${plotNumber(p.data.share, 1)}%)\nGroup total: ${plotNumber(p.data.n)} records`,
      },
      series: categories.map((rank, i) => ({
        name: rank,
        type: "bar",
        stack: c.chart === "grouped" ? undefined : "composition",
        barMaxWidth: 90,
        itemStyle: { color: colors[i % colors.length] },
        emphasis: { focus: "series" },
        // Only segments large enough to hold their label are labelled.
        label: {
          show: c.labels,
          fontSize: 13,
          color: "#fff",
          formatter: (p: any) =>
            p.data.share >= 6
              ? percent
                ? plotNumber(p.data.share, 0) + "%"
                : plotNumber(p.data.count)
              : "",
        },
        data: groups.map((g) => {
          const count = g.rows.filter(
            (a) =>
              (c.level === "rank" || c.level === "qualification"
                ? a.qualification
                : a.rank) === rank,
          ).length;
          const share = g.rows.length ? (100 * count) / g.rows.length : 0;
          return {
            groupId: g.id,
            value: percent ? share : count,
            count,
            share,
            n: g.rows.length,
          };
        }),
      })),
    };
  }
  // Groups without a value stay in the statistics table, not as empty rows.
  const shown = groups
    .filter((g) => g.value !== null)
    .sort((a, b) => Number(a.lowN) - Number(b.lowN) || b.value! - a.value!);
  const shownLabels = shown.map((g) => short(g.label));
  const topId = shown.find((g) => !g.lowN)?.id;
  // The axis fits the groups. A pinned person far above them is marked at the
  // right edge ("off scale") with a percentile, instead of stretching every bar flat.
  const dataMax = Math.max(0, ...shown.map((g) => g.value ?? 0));
  const axisMax = c.log
    ? 10 ** Math.ceil(Math.log10((dataMax || 1) * 1.05))
    : (() => {
        const step = 10 ** Math.floor(Math.log10(dataMax || 1)) / 2;
        return Math.max(step, Math.ceil((dataMax * 1.15) / step) * step);
      })();
  const pool = numeric
    ? values(groups.flatMap((g) => g.rows).map((a) => a[metric])).filter((v) => !c.log || v > 0)
    : [];
  const standing = (value: number) => {
    const pct = percentile(pool, value);
    return { pct, text: pct === null ? "" : aheadOf(pct) };
  };
  // Each pinned person gets their own marker on the row of the group they belong to.
  // Several people in one row are spread vertically so none hide another.
  const rowOf = (a: Academic) => {
    const direct = shown.findIndex((g) => g.rows.some((r) => r.id === a.id));
    return direct >= 0 ? direct : shown.findIndex((g) => g.id === groupKey(a, c.level));
  };
  const placedPeople = barReferences
    .map((a) => ({ a, row: rowOf(a), i: pinned.findIndex((p) => p.id === a.id) }))
    .filter((r) => r.row >= 0);
  const perRow = new Map<number, number>();
  for (const r of placedPeople) perRow.set(r.row, (perRow.get(r.row) || 0) + 1);
  const seen = new Map<number, number>();
  const markers = placedPeople.map((r) => {
    const k = seen.get(r.row) || 0;
    seen.set(r.row, k + 1);
    const n = perRow.get(r.row)!;
    const value = r.a[metric]!;
    const off = value > axisMax;
    const other = otherProvider.get(r.a.id) ?? null;
    const { pct, text } = other ? { pct: null, text: "" } : standing(value);
    const tone = personColors[r.i % personColors.length];
    return {
      name: r.a.name,
      value: [Math.min(value, axisMax), shownLabels[r.row]],
      symbolOffset: [0, (k - (n - 1) / 2) * 20],
      // A hollow marker means: real value, but from another provider than the bars.
      itemStyle: other
        ? { color: "#fff", borderColor: tone, borderWidth: 3 }
        : { color: tone, borderColor: "#fff", borderWidth: 2 },
      label: {
        show: true,
        position: "right",
        distance: 10,
        fontSize: 12,
        // The standing text carries the same red-yellow-green colour as everywhere else.
        formatter: `${r.i + 1} · ${plotNumber(value)} · ${other ? `not ranked (${other})` : pct === null ? "too few peers to rank" : `{s|${text}}`}${off ? " ▸" : ""}`,
        rich: pct === null ? undefined : { s: { color: standingColor(pct), fontWeight: 700, fontSize: 12 } },
        backgroundColor: "rgba(255,255,255,.94)",
        borderRadius: 6,
        padding: [3, 6],
      },
      referenceNames: r.a.name,
      trueValue: value,
      off,
      pctText: text,
      other,
    };
  });
  const placedIds = new Set(placedPeople.map((r) => r.a.id));
  // Only people with no row in the chart (external references) fall back to a line.
  const lineRefs = barReferences.filter((a) => !placedIds.has(a.id));
  const lineValues = [...new Set(lineRefs.map((a) => a[metric]!))];
  return {
    ...base,
    legend: { show: false },
    grid: { left: 15, right: markers.length ? 210 : 70, top: 15, bottom: 65, containLabel: true },
    xAxis: {
      type: c.log ? "log" : "value",
      name: metricLabels[c.metric],
      nameLocation: "middle",
      nameGap: 35,
      axisLabel: { fontSize: 14 },
      max: axisMax,
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: shownLabels,
      axisLabel: {
        fontSize: 14,
        lineHeight: 20,
        width: 210,
        overflow: "truncate",
        formatter: (value: string) => {
          const [unit, ...parents] = value.split(" · ");
          return parents.length
            ? unit.replace(/^Faculty of /, "") +
                "\n" +
                short(parents.join(" · "))
            : value;
        },
      },
    },
    dataZoom:
      shownLabels.length > 14
        ? [
            {
              type: "slider",
              yAxisIndex: 0,
              right: 5,
              width: 20,
              startValue: 0,
              endValue: 13,
              minValueSpan: 13,
              maxValueSpan: 13,
              zoomLock: true,
              showDataShadow: false,
              showDetail: false,
              brushSelect: false,
            },
          ]
        : [],
    series: [
      {
        name:
          c.weight === "equal" && c.level === "type"
            ? "Mean of university statistics"
            : c.aggregation,
        type: "bar",
        barMaxWidth: 28,
        itemStyle: { borderRadius: [0, 5, 5, 0] },
        label: { show: c.labels, position: "right", fontSize: 14 },
        markLine: lineValues.length ? {
          symbol: "none",
          silent: false,
          animation: false,
          data: lineValues.map((value) => {
            const people = lineRefs.filter((a) => a[metric] === value);
            const indices = people.map((a) => pinned.findIndex((p) => p.id === a.id));
            const off = value > axisMax;
            const pctText = standing(value).text;
            return {
              name: people.map((a) => a.name).join(", "),
              referenceNames: people.map((a) => a.name).join(", "),
              xAxis: Math.min(value, axisMax),
              trueValue: value,
              off,
              pctText,
              lineStyle: { color: personColors[indices[0] % personColors.length], width: 2, type: "dashed" },
              label: {
                show: true,
                position: "insideEndTop",
                rotate: 0,
                align: "right",
                formatter: `${indices.map((i) => i + 1).join(", ")} · ${plotNumber(value)}${off ? " ▸" : ""}${pctText ? "\n" + pctText : ""}`,
                fontSize: 13,
                lineHeight: 18,
                backgroundColor: "rgba(255,255,255,.94)",
                borderRadius: 6,
                padding: [4, 7],
              },
            };
          }),
        } : undefined,
        data: shown.map((g) => ({
          name: g.label,
          // On a log axis, non-positive values cannot be drawn: they are left
          // out (and reported beside the chart), never shifted to 1.
          value: c.log && g.value !== null && g.value <= 0 ? null : g.value,
          groupId: g.id,
          itemStyle: {
            color: g.lowN
              ? "#a9b6c2"
              : c.level === "type"
                ? g.id === "Public"
                  ? "#3b4fd6"
                  : "#0f9488"
                : g.id === topId
                  ? "#f59e0b"
                  : "#3b4fd6",
            ...(g.lowN
              ? {
                  decal: {
                    symbol: "rect",
                    dashArrayX: [1, 0],
                    dashArrayY: [3, 3],
                    rotation: -Math.PI / 4,
                    color: "rgba(255,255,255,.55)",
                  },
                }
              : {}),
          },
          n: g.n,
          lowN: g.lowN,
        })),
        tooltip: {
          formatter: (p: any) =>
            p.data.referenceNames
              ? `${p.data.referenceNames}\nIndividual ${metricLabels[c.metric]}: ${plotNumber(p.data.trueValue ?? p.data.xAxis)}${p.data.pctText ? "\n" + p.data.pctText + " in this comparison" : ""}${p.data.other ? "\nFrom " + p.data.other + ", not the bars' provider: not ranked" : ""}${p.data.off ? "\nShown at the chart edge (beyond its scale)" : ""}`
              : `${p.name}\n${c.aggregation === "total" ? "Total" : c.aggregation[0].toUpperCase() + c.aggregation.slice(1)} ${metricLabels[c.metric].toLowerCase()}: ${plotNumber(p.value)}${["phd", "overseas"].includes(c.metric) ? "%" : ""}\nValid records: ${p.data.n}${p.data.lowN ? "\nNot ranked (fewer than 10 valid values, shown for reference)" : ""}${c.weight === "equal" && c.level === "type" ? "\nEach university contributes equally" : ""}`,
        },
      },
      ...(markers.length
        ? [
            {
              name: "Pinned people",
              type: "scatter",
              symbol: "diamond",
              symbolSize: 17,
              z: 10,
              data: markers,
              tooltip: {
                formatter: (p: any) =>
                  `${p.data.referenceNames}\nIndividual ${metricLabels[c.metric]}: ${plotNumber(p.data.trueValue)}${p.data.pctText ? "\n" + p.data.pctText + " in this comparison" : ""}${p.data.off ? "\nShown at the chart edge (beyond its scale)" : ""}`,
              },
            },
          ]
        : []),
    ],
  };
}
