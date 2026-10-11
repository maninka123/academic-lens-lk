import { useState, useEffect } from "react";
import {
  Share2,
  Download,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Trash2,
} from "lucide-react";
import { useData } from "../data/context";
import { useAtlas, encodeState } from "../store";
import {
  metricLabels,
  levelLabels,
  type Level,
  type Metric,
  type ChartType,
  type Aggregation,
  type NumericMetric,
} from "../types";
import {
  filterAcademics,
  compare,
  groupRows,
  validModes,
} from "../analytics/engine";
import { comparisonChart } from "../analytics/charts";
import { Chart } from "../components/Chart";
import { Filters, Multi } from "../components/Filters";
import { Pinned } from "../components/Pinned";
import { AcademicTable } from "../components/AcademicTable";
import { Header, fmt, exportCsv, Empty } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
const charts: Record<ChartType, string> = {
  bar: "Bar",
  grouped: "Grouped composition",
  stacked: "Stacked composition",
  percentStacked: "100% stacked composition",
  scatter: "Scatter",
  bubble: "Bubble (size = h-index)",
  box: "Box plot",
  histogram: "Histogram",
  heatmap: "Heatmap",
  treemap: "Treemap",
};
export function Compare() {
  const d = useData();
  const {
    config: c,
    configure,
    setFilters,
    filters,
    pinned,
    custom,
    saveGroup,
    deleteGroup,
  } = useAtlas();
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width:760px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const handler = () => {
      setMobile(query.matches);
      setLeft(!query.matches);
      setRight(!query.matches);
    };
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  const [left, setLeft] = useState(
      () => !window.matchMedia("(max-width:760px)").matches,
    ),
    [right, setRight] = useState(
      () => !window.matchMedia("(max-width:760px)").matches,
    ),
    [notice, setNotice] = useState(""),
    [groupName, setGroupName] = useState("");
  const rows = filterAcademics(d.academics, filters),
    groups = compare(rows, c, custom),
    selected = pinned.flatMap((id) => {
      const a = d.academics.find((a) => a.id === id);
      return a ? [a] : [];
    }),
    options = groupRows(rows, c.level, custom);
  const selectedRows = [
    ...new Map(groups.flatMap((g) => g.rows).map((a) => [a.id, a])).values(),
  ];
  const has = groups.some((g) => g.value !== null);
  const numeric = !["count", "phd", "overseas"].includes(c.metric);
  const composition = ["grouped", "stacked", "percentStacked"].includes(
    c.chart,
  );
  async function share() {
    const link =
      location.origin +
      location.pathname +
      "#/compare?view=" +
      encodeURIComponent(encodeState()) +
      "&dataset=" +
      encodeURIComponent(d.metadata.version);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Comparison link copied.");
    } catch {
      setNotice("Copy this link: " + link);
    }
  }
  const controls = (
    <aside className="configuration">
      <div className="step-label">01 · Define your comparison</div>
      <label className="field">
        Comparison level
        <select
          aria-label="Comparison level"
          value={c.level}
          onChange={(e) =>
            configure({ level: e.target.value as Level, groups: [] })
          }
        >
          {Object.entries(levelLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <Multi
        label="Comparison groups"
        options={options.map((g) => ({ value: g.id, label: g.label }))}
        selected={c.groups}
        onChange={(groups) => configure({ groups })}
      />
      <div className="step-label">02 · Choose the measurement</div>
      <label className="field">
        Measurement
        <select
          aria-label="Measurement"
          value={c.metric}
          onChange={(e) => configure({ metric: e.target.value as Metric })}
        >
          {Object.entries(metricLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Aggregation
        <select
          aria-label="Aggregation"
          value={c.aggregation}
          onChange={(e) =>
            configure({ aggregation: e.target.value as Aggregation })
          }
        >
          {validModes(c.metric).map((v) => (
            <option key={v} value={v}>
              {
                {
                  median: "Median",
                  mean: "Mean per valid academic",
                  total: "Combined career total",
                  per10: "Per 10 valid academics",
                  distribution: "Individual distribution",
                  percentage: "Percentage of known records",
                }[v]
              }
            </option>
          ))}
        </select>
      </label>
      {c.level === "type" && (
        <label className="field">
          University weighting
          <select
            value={c.weight}
            aria-label="University weighting"
            onChange={(e) =>
              configure({ weight: e.target.value as "pooled" | "equal" })
            }
          >
            <option value="pooled">Pooled academics</option>
            <option value="equal">Equal university weight</option>
          </select>
        </label>
      )}
      <div className="step-label">03 · Visualise</div>
      <label className="field">
        Chart type
        <select
          aria-label="Chart type"
          value={c.chart}
          onChange={(e) => configure({ chart: e.target.value as ChartType })}
        >
          {Object.entries(charts)
            .filter(
              ([v]) =>
                numeric ||
                !["scatter", "bubble", "box", "histogram"].includes(v),
            )
            .map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
        </select>
      </label>
      {["scatter", "bubble"].includes(c.chart) && numeric && (
        <label className="field">
          Horizontal axis
          <select
            value={c.xMetric}
            onChange={(e) =>
              configure({ xMetric: e.target.value as NumericMetric })
            }
          >
            {Object.entries(metricLabels)
              .filter(([k]) => !["count", "phd", "overseas"].includes(k))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="field">
        Order groups
        <select
          aria-label="Order groups"
          value={c.sort || "name"}
          onChange={(e) =>
            configure({ sort: e.target.value as "name" | "value" })
          }
        >
          <option value="name">Alphabetical</option>
          <option value="value">Statistic, highest first</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={c.labels}
          onChange={(e) => configure({ labels: e.target.checked })}
        />
        Show data labels
      </label>
      {!["box", "histogram", "heatmap", "treemap"].includes(c.chart) && (
        <label className="check">
          <input
            type="checkbox"
            checked={c.log}
            onChange={(e) => configure({ log: e.target.checked })}
          />
          Logarithmic scale (positive values)
        </label>
      )}
      <Filters compact />
      <details className="custom-builder" open={c.level === "custom"}>
        <summary>Custom academic groups</summary>
        <p className="caption">
          Save the current pinned selection as a named group. Groups persist in
          this browser and can be shared.
        </p>
        <label className="field">
          Group name
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Computing colleagues"
          />
        </label>
        <Button
          variant="outline"
          disabled={!groupName.trim() || !pinned.length}
          onClick={() => {
            saveGroup({
              id: "custom-" + Date.now(),
              name: groupName.trim(),
              ids: [...pinned],
            });
            setGroupName("");
            configure({ level: "custom", groups: [] });
          }}
        >
          <Plus size={17} />
          Save {pinned.length} pinned academics
        </Button>
        {custom.map((g) => (
          <div className="group-item" key={g.id}>
            <span>
              {g.name} · {g.ids.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={"Delete group " + g.name}
              onClick={() => deleteGroup(g.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </details>
    </aside>
  );
  return (
    <>
      <Header
        eyebrow="Your analytical workspace"
        title="Comparison Studio"
        description="Build a peer group. Explore the distribution. Keep people in perspective."
        action={
          <Button variant="outline" onClick={share}>
            <Share2 size={18} />
            Share comparison
          </Button>
        }
      />
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
      <div className="studio-toolbar">
        <div className="inline">
          <Button variant="ghost" onClick={() => setLeft(!left)}>
            <PanelLeftClose size={18} />
            {left ? "Hide" : "Show"} controls
          </Button>
          <Button variant="ghost" onClick={() => setRight(!right)}>
            <PanelRightClose size={18} />
            {right ? "Hide" : "Show"} pinned academics
          </Button>
        </div>
        <span>
          {selectedRows.length.toLocaleString()} profiles in comparison
        </span>
      </div>
      <div
        className={
          "studio " + (!left ? "no-left " : "") + (!right ? "no-right" : "")
        }
      >
        {left && !mobile && controls}
        <main className="studio-main">
          <div className="chart-title">
            <div className="eyebrow">
              {levelLabels[c.level]} ·{" "}
              {composition ? "Academic composition" : c.aggregation}
            </div>
            <h2>
              {composition
                ? "Qualifications & academic positions"
                : metricLabels[c.metric]}
            </h2>
            <p>
              {groups.length} groups ·{" "}
              {c.level === "type" && c.weight === "equal"
                ? "Equal university weight"
                : "Pooled academics"}{" "}
              · {d.metadata.window.join("–")} recent window
            </p>
          </div>
          {c.chart === "heatmap" && (
            <div className="inline-note">
              Colours are normalised separately within each metric column.
              Labels show actual values; no overall score is calculated.
            </div>
          )}
          {c.log && (
            <div className="inline-note">
              Logarithmic axes display positive values only. Zeros remain in the
              statistics and data table.
            </div>
          )}
          {composition && (
            <div className="inline-note">
              Composition charts show record counts or percentages by
              rank/qualification, including Unknown, rather than the selected
              research metric.
            </div>
          )}
          {["box", "histogram", "scatter", "bubble"].includes(c.chart) && (
            <div className="inline-note">
              Individual distributions use pooled valid values. University
              weighting applies to aggregate statistics in the table.
            </div>
          )}
          {has || composition ? (
            <Chart
              option={comparisonChart(rows, c, selected, custom)}
              height={450}
              onClick={(p) => {
                if (p.data?.academicId)
                  useAtlas.getState().pin(p.data.academicId);
                else if (p.data?.groupId) {
                  const g = groups.find((g) => g.id === p.data.groupId);
                  const a = g?.rows[0];
                  if (a && c.level === "university") {
                    setFilters({
                      universities: [a.universityId],
                      faculties: [],
                      departments: [],
                    });
                    configure({ level: "faculty", groups: [] });
                  } else if (a && c.level === "faculty") {
                    setFilters({
                      universities: [a.universityId],
                      faculties: a.facultyId ? [a.facultyId] : [],
                      departments: [],
                    });
                    configure({ level: "department", groups: [] });
                  }
                }
              }}
              label={`${metricLabels[c.metric]} comparison`}
            />
          ) : (
            <Empty>
              {c.level === "custom"
                ? "Create a group from pinned academics to start a comparison."
                : `No valid ${metricLabels[c.metric].toLowerCase()} in these groups. Try another metric or switch to Demo Data.`}
            </Empty>
          )}
          {c.metric === "hIndex" && (
            <p className="inline-note">
              Individual h-index values are never summed or presented as
              institutional h-index.
            </p>
          )}
          {c.aggregation === "total" && numeric && (
            <p className="inline-note">
              Combined career metrics of current listed academics. Publications
              can include work at earlier institutions and repeated coauthored
              papers.
            </p>
          )}
          {c.metric === "phd" && (
            <p className="inline-note">
              Denominator: records with documented qualifications. Unknown
              qualification records are excluded from this percentage and
              counted separately in composition charts.
            </p>
          )}
          {c.metric === "overseas" && (
            <p className="inline-note">
              Denominator: recorded PhD holders with a known
              awarding-institution country. These records are extracted evidence
              and require factual review.
            </p>
          )}
          <div className="section-heading">
            <h3>Supporting statistics</h3>
            <Button variant="ghost" onClick={() => exportCsv(selectedRows)}>
              <Download size={17} />
              Export records
            </Button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Comparison group</th>
                  <th>Value</th>
                  <th>Valid / records</th>
                  <th>Completeness</th>
                  {c.level === "type" && c.weight === "equal" && (
                    <th>Valid universities</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.label}</td>
                    <td className="numeric">{fmt(g.value, 1)}</td>
                    <td>
                      {g.n} / {g.total}
                    </td>
                    <td>
                      {g.total ? fmt((g.n / g.total) * 100, 1) + "%" : "—"}
                    </td>
                    {c.level === "type" && c.weight === "equal" && (
                      <td>{g.universityN}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
        {right && !mobile && <Pinned />}
      </div>
      {mobile && (
        <>
          <Dialog
            open={left}
            onOpenChange={setLeft}
            title="Comparison controls"
          >
            {controls}
          </Dialog>
          <Dialog open={right} onOpenChange={setRight} title="Pinned academics">
            <Pinned />
          </Dialog>
        </>
      )}
      <section className="card supporting">
        <div className="section-heading">
          <h2>Profiles behind this comparison</h2>
        </div>
        <AcademicTable rows={selectedRows} />
      </section>
    </>
  );
}
