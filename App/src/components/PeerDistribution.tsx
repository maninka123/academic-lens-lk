import type { Academic, NumericMetric, Provider } from "../types";
import { metricLabels } from "../types";
import { plotNumber } from "../analytics/plot-format";
import { withProvider } from "../analytics/quality";
import type { buildPeerGroups } from "../analytics/profile-peers";
import { Chart } from "./Chart";

type Group = ReturnType<typeof buildPeerGroups>["groups"][number];
export type PeerChartView = "benchmarks" | "distribution" | "scatter";
// Stable spread reveals overlapping values; it does not encode a second variable.
const spread = (id: string) => {
  let hash = 0;
  for (const c of id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return 0.15 + (hash % 701) / 1000;
};
export function PeerDistribution({
  academic,
  group,
  metric,
  horizontal,
  provider,
  view,
  log,
}: {
  academic: Academic;
  group: Group;
  metric: NumericMetric;
  horizontal: NumericMetric;
  provider: Provider;
  view: Exclude<PeerChartView, "benchmarks">;
  log: boolean;
}) {
  const paired = view === "scatter";
  const measured = withProvider(group.members, provider).rows;
  const valid = measured.filter(
    (r) =>
      Number.isFinite(r[metric]) && (!paired || Number.isFinite(r[horizontal])),
  );
  const person = withProvider([academic], provider).rows[0];
  const personAvailable =
    Number.isFinite(person[metric]) &&
    (!paired || Number.isFinite(person[horizontal]));
  const convert = (v: number) => (log ? Math.log10(v + 1) : v);
  const point = (r: Academic) => ({
    name: r.name,
    value: [
      convert((paired ? r[horizontal] : r[metric])!),
      paired ? convert(r[metric]!) : spread(r.id),
    ],
    rawX: paired ? r[horizontal] : r[metric],
    rawY: r[metric],
    university: r.university,
    position: r.position || r.rank,
    id: r.id,
  });
  const others = valid.filter((r) => r.id !== academic.id).map(point);
  const highlighted = personAvailable ? [point(person)] : [];
  const scale = log ? " (compressed scale)" : "";
  return (
    <>
      <p className="peer-plot-caption">
        {paired
          ? `${valid.length} group profiles have both measurements from ${provider}.`
          : `${valid.length} group profiles have a ${metricLabels[metric].toLowerCase()} value from ${provider}.`}{" "}
        {!personAvailable &&
          "This person has no comparable value for this view."}
      </p>
      <Chart
        height={340}
        label={`${paired ? "Scatter plot" : "Value distribution"}: ${group.label}. Each dot is one profile. ${academic.name} is a green diamond. ${paired ? metricLabels[horizontal] + " versus " : ""}${metricLabels[metric]}. ${valid.length} usable group profiles.`}
        option={{
          legend: {
            top: 0,
            data: ["Group profiles", "This person"],
            icon: "circle",
          },
          grid: { left: paired ? 65 : 25, right: 30, top: 48, bottom: 65 },
          tooltip: {
            trigger: "item",
            renderMode: "richText",
            confine: true,
            formatter: (p: any) => {
              const d = p.data;
              return `${d.name}${d.id === academic.id ? " | This person" : ""}\n${d.university}\n${d.position}\n${paired ? metricLabels[horizontal] + ": " + plotNumber(d.rawX) + "\n" : ""}${metricLabels[metric]}: ${plotNumber(d.rawY)}\n${provider}`;
            },
          },
          xAxis: {
            type: "value",
            min: 0,
            name: metricLabels[paired ? horizontal : metric] + scale,
            nameLocation: "middle",
            nameGap: 42,
            axisLabel: log
              ? { formatter: (v: number) => plotNumber(Math.pow(10, v) - 1) }
              : {},
          },
          yAxis: paired
            ? {
                type: "value",
                min: 0,
                name: metricLabels[metric] + scale,
                nameGap: 20,
                axisLabel: log
                  ? {
                      formatter: (v: number) => plotNumber(Math.pow(10, v) - 1),
                    }
                  : {},
              }
            : { type: "value", min: 0, max: 1, show: false },
          series: [
            {
              name: "Group profiles",
              type: "scatter",
              data: others,
              symbolSize: 9,
              itemStyle: { color: "#5d6cf0", opacity: 0.6 },
              markLine:
                group.median == null
                  ? undefined
                  : {
                      silent: true,
                      symbol: ["none", "none"],
                      label: {
                        formatter: () => `Median ${plotNumber(group.median)}`,
                        position: "insideEndTop",
                        color: "#5d6cf0",
                      },
                      lineStyle: { color: "#5d6cf0", type: "dashed" },
                      data: [
                        paired
                          ? { yAxis: convert(group.median) }
                          : { xAxis: convert(group.median) },
                      ],
                    },
            },
            {
              name: "This person",
              type: "scatter",
              data: highlighted,
              symbol: "diamond",
              symbolSize: 20,
              z: 5,
              itemStyle: {
                color: "#e0a02e",
                opacity: 1,
                borderColor: "#fff",
                borderWidth: 2,
              },
            },
          ],
        }}
      />
      <p className="caption">
        {paired
          ? "Only profiles with both values enter this scatter plot. The peer statistics use every available value of the selected measurement."
          : "Horizontal position shows the value. Vertical spacing separates overlapping dots and has no statistical meaning."}{" "}
        {log &&
          "Axes display original values on a compressed log₁₀(value + 1) scale."}
      </p>
    </>
  );
}
