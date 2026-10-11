import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  Users,
  Globe2,
  FlaskConical,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useData } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import {
  filterAcademics,
  groupRows,
  aggregate,
  values,
  sum,
} from "../analytics/engine";
import { Header, Card, Stat, short, fmt, colors } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import type { Config } from "../types";
import { GlobalTeaser } from "./Global";
export function Overview() {
  const { academics, universities, metadata } = useData();
  const { filters, configure, setFilters } = useAtlas();
  const nav = useNavigate(),
    rows = filterAcademics(academics, filters);
  const groups = universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const countries = groupRows(
    rows.filter((a) => a.phdCountry && a.qualification === "PhD"),
    "phdCountry",
  ).sort((a, b) => b.rows.length - a.rows.length);
  const ranks = groupRows(rows, "rank").sort(
    (a, b) => b.rows.length - a.rows.length,
  );
  const pub = values(rows.map((a) => a.publications)),
    cit = values(rows.map((a) => a.citations));
  const preset = (c: Partial<Config>, f?: Parameters<typeof setFilters>[0]) => {
    configure({
      level: "university",
      groups: [],
      metric: "citations",
      aggregation: "median",
      chart: "bar",
      ...c,
    });
    setFilters({ ...emptyFilters(), ...f });
    nav("/compare");
  };
  const barOption = {
    tooltip: { trigger: "axis", renderMode: "richText" },
    grid: { left: 135, right: 45, top: 15, bottom: 35 },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { fontSize: 14, formatter: (v: number) => fmt(v) },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: groups.map((g) => g.short),
      axisLabel: { fontSize: 15 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: groups.map((g) => ({
          value: g.rows.length,
          universityId: g.id,
          itemStyle: {
            color: g.type === "Public" ? "#2675b9" : "#169688",
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: "right",
          fontSize: 14,
          formatter: (p: any) => fmt(p.value),
        },
      },
    ],
  };
  return (
    <>
      <Header
        eyebrow="Sri Lanka · Academic intelligence"
        title="A clearer view of our academic landscape."
        description="Explore institutions, connect academic profiles, and build comparisons grounded in the data."
        action={
          <Button onClick={() => preset({})}>
            Open Comparison Studio
            <ArrowUpRight size={18} />
          </Button>
        }
      />
      <div className="overview-band">
        <div>
          <span className="status-dot" /> Partial collection ·{" "}
          {metadata.collectionDate}
        </div>
        <Link to="/methodology">
          Understand the coverage <ArrowRight size={16} />
        </Link>
      </div>
      <div className="stats-grid">
        <Stat
          label="Institutions in scope"
          value={universities.length}
          detail={`${groups.filter((g) => g.rows.length).length} with collected records`}
        />
        <Stat
          label="Academic profiles"
          value={fmt(rows.length)}
          detail="Records in the filtered dataset"
        />
        <Stat
          label="Public academics"
          value={fmt(rows.filter((a) => a.type === "Public").length)}
          detail="Published academic listings"
        />
        <Stat
          label="Non-state academics"
          value={fmt(rows.filter((a) => a.type === "Non-state").length)}
          detail="Published academic listings"
        />
        <Stat
          label="Recorded PhD holders"
          value={rows.filter((a) => a.qualification === "PhD").length}
          detail="Extracted degree evidence; review required"
        />
        <Stat
          label="PhD countries"
          value={countries.length}
          detail="Known awarding-institution countries"
        />
        <Stat
          label="Recorded publications"
          value={pub.length ? fmt(sum(pub)) : "Not available"}
          detail={`${pub.length} valid profiles · combined career metrics`}
        />
        <Stat
          label="Recorded citations"
          value={cit.length ? fmt(sum(cit)) : "Not available"}
          detail={`${cit.length} valid profiles · indexed snapshots`}
        />
      </div>
      <div className="overview-grid">
        <Card
          title="The institutional landscape"
          subtitle="Academic records collected · click an institution to explore"
          action={
            <span className="legend-inline">
              <i className="blue" />
              Public <i className="teal" />
              Non-state
            </span>
          }
        >
          <Chart
            option={barOption}
            height={480}
            onClick={(p) =>
              p.data?.universityId && nav("/university/" + p.data.universityId)
            }
          />
        </Card>
        <div className="overview-right">
          <Card
            title="Make the comparison yours"
            subtitle="Start with a question, then explore the evidence."
            className="preset-card"
          >
            <div className="preset-list">
              {[
                {
                  label: "Public vs Non-state",
                  sub: "Two perspectives on the landscape",
                  icon: Building2,
                  c: { level: "type" },
                },
                {
                  label: "Engineering across universities",
                  sub: "Manually mapped equivalent fields",
                  icon: FlaskConical,
                  c: { level: "university" },
                  f: { fields: ["Engineering"] },
                },
                {
                  label: "Academic positions",
                  sub: "Explore qualifications by rank",
                  icon: Users,
                  c: {
                    level: "rank",
                    metric: "phd",
                    aggregation: "percentage",
                  },
                },
                {
                  label: "Recent research impact",
                  sub: metadata.window.join("–") + " citation distributions",
                  icon: ArrowUpRight,
                  c: {
                    metric: "recentCitations",
                    aggregation: "distribution",
                    chart: "box",
                  },
                },
                {
                  label: "PhD origins",
                  sub: "Follow international academic pathways",
                  icon: Globe2,
                  c: { level: "phdCountry" },
                },
              ].map((p: any) => (
                <button key={p.label} onClick={() => preset(p.c, p.f)}>
                  <span className="preset-icon">
                    <p.icon size={22} />
                  </span>
                  <span>
                    <strong>{p.label}</strong>
                    <small>{p.sub}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
            <Link className="text-link" to="/compare">
              Build a custom comparison <ArrowRight size={17} />
            </Link>
          </Card>
          <div className="coverage-note">
            <div className="eyebrow">Context matters</div>
            <h3>A profile is more than a citation count.</h3>
            <p>
              Compare within fields and positions. Check valid sample sizes.
              Keep missing data visible.
            </p>
            <Link to="/methodology">
              Read the methodology <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </div>
      <div className="two-columns align-start">
        <Card
          title="Academic positions"
          subtitle="Original titles are retained in each profile"
        >
          <Chart
            height={320}
            option={{
              tooltip: { renderMode: "richText" },
              legend: { show: false },
              series: [
                {
                  type: "pie",
                  radius: ["45%", "72%"],
                  center: ["50%", "50%"],
                  label: { show: false },
                  data: ranks.map((g, i) => ({
                    name: g.label,
                    value: g.rows.length,
                    itemStyle: { color: colors[i % colors.length] },
                  })),
                },
              ],
            }}
            onClick={(p) => {
              preset({ level: "rank", groups: [p.name] });
            }}
          />
          <ul className="position-legend" aria-label="Academic position legend">
            {ranks.map((g, i) => (
              <li key={g.id}>
                <button
                  onClick={() => preset({ level: "rank", groups: [g.id] })}
                >
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  <span>{g.label}</span>
                  <strong>{g.rows.length.toLocaleString()}</strong>
                  <span>
                    {rows.length
                      ? ((100 * g.rows.length) / rows.length).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title="Research comparison"
          subtitle="Median citations · valid records only; collected coverage varies"
        >
          <Chart
            height={560}
            label="Median citations by institution"
            option={{
              tooltip: { trigger: "axis", renderMode: "richText" },
              grid: {
                left: 10,
                right: 60,
                top: 10,
                bottom: 30,
                containLabel: true,
              },
              yAxis: {
                type: "category",
                inverse: true,
                data: groups.map((g) => g.short),
                axisLabel: { fontSize: 14 },
              },
              xAxis: {
                type: "value",
                name: "Median citations",
                nameLocation: "middle",
                nameGap: 28,
                axisLabel: { fontSize: 13 },
              },
              series: [
                {
                  type: "bar",
                  barMaxWidth: 18,
                  label: { show: true, position: "right", fontSize: 13 },
                  data: groups.map((g) => ({
                    value: aggregate(g.rows, "citations", "median").value,
                    itemStyle: {
                      color: g.type === "Public" ? "#2675b9" : "#169688",
                      borderRadius: [0, 4, 4, 0],
                    },
                  })),
                },
              ],
            }}
          />
        </Card>
      </div>
      <Card
        title="Qualifications across institutions"
        subtitle="Percent of all collected profiles · Unknown remains a visible category"
      >
        <Chart
          height={350}
          option={{
            tooltip: { trigger: "axis", renderMode: "richText" },
            legend: { top: 0, textStyle: { fontSize: 14 } },
            grid: { left: 60, right: 20, top: 55, bottom: 80 },
            xAxis: {
              type: "category",
              data: groups.map((g) => g.short),
              axisLabel: { fontSize: 14, rotate: 35 },
            },
            yAxis: { type: "value", max: 100, name: "Percent" },
            series: [
              "PhD",
              "Masters / MPhil",
              "Bachelors",
              "Other documented",
              "Unknown",
            ].map((q, i) => ({
              type: "bar",
              name: q,
              stack: "qualifications",
              itemStyle: { color: q === "Unknown" ? "#d3dce4" : colors[i] },
              data: groups.map((g) =>
                g.rows.length
                  ? (100 * g.rows.filter((a) => a.qualification === q).length) /
                    g.rows.length
                  : null,
              ),
            })),
          }}
        />
      </Card>
      <GlobalTeaser />
      <Card
        title="Explore an institution"
        subtitle="Follow the hierarchy from university to faculty, department and academic."
      >
        <div className="institution-grid">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={"/university/" + g.id}
              className="institution-card"
            >
              <span
                className={
                  "institution-monogram " +
                  (g.type === "Non-state" ? "nonstate" : "")
                }
              >
                {g.short.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{short(g.name)}</strong>
                <small>
                  {g.type} ·{" "}
                  {g.rows.length
                    ? g.rows.length + " profiles"
                    : "No collected profiles"}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
