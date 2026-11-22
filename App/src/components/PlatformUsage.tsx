import { useEffect, useMemo, useState } from "react";
import { Card, fmt } from "./common";
import { Chart } from "./Chart";
import { loadUsage, summarizeUsage, type Usage } from "../analytics/usage";
import { PRIVACY_URL } from "./guideLinks";

const dateText = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Kpi({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** The Website Analytics card on Data & Methodology: KPIs and a daily chart from the approved aggregate file (site-wide figures only).
 *  Without that file it shows a compact "not yet available" state, never placeholder numbers. */
export function PlatformUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let live = true;
    loadUsage().then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, []);
  const summary = useMemo(() => (usage ? summarizeUsage(usage) : null), [usage]);
  return (
    <Card title="Website Analytics">
      {usage && summary ? (
        <>
          <dl className="usage-tiles">
            <Kpi label="Total visits" value={fmt(usage.visits)} />
            <Kpi label="Total page views" value={fmt(usage.pageViews)} />
            <Kpi
              label="Page views per visit"
              value={summary.pageViewsPerVisit === null ? "—" : fmt(summary.pageViewsPerVisit, 2)}
              title="Total page views divided by total visits"
            />
            <Kpi label="Average daily visits" value={fmt(summary.avgDailyVisits, 1)} title={`Total visits divided by the ${summary.days} calendar days in the reporting period`} />
          </dl>
          <Chart
            height={260}
            minWidth={320}
            label="Daily visits and page views"
            option={{
              tooltip: { trigger: "axis", confine: true },
              legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 14, itemHeight: 4 },
              grid: { left: 10, right: 20, top: 40, bottom: summary.days > 45 ? 56 : 30, containLabel: true },
              dataZoom: summary.days > 45 ? [{ type: "inside" }, { type: "slider", height: 18, bottom: 6 }] : undefined,
              xAxis: { type: "category", data: summary.series.map((d) => d.date), axisLabel: { hideOverlap: true } },
              yAxis: { type: "value", minInterval: 1 },
              series: [
                { name: "Page views", type: "line", data: summary.series.map((d) => d.pageViews), connectNulls: false, showSymbol: summary.days < 40, lineStyle: { color: "#5d6cf0", width: 2 }, itemStyle: { color: "#5d6cf0" } },
                { name: "Visits", type: "line", data: summary.series.map((d) => d.visits), connectNulls: false, showSymbol: summary.days < 40, lineStyle: { color: "#1f9d8a", width: 2 }, itemStyle: { color: "#1f9d8a" } },
              ],
            }}
          />
          <p className="caption usage-meta">
            Reporting period {dateText(usage.periodStart)} to {dateText(usage.periodEnd)} | Last updated {dateText(usage.updated)}
          </p>
        </>
      ) : (
        <p className="usage-empty" role="status">Analytics data not yet available</p>
      )}
      <p className="caption usage-foot">
        Source: {usage?.source ?? "Cloudflare Web Analytics"} | Usage statistics are approximate. <a className="text-link" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy Notice</a>
      </p>
    </Card>
  );
}
