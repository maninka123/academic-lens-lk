import {
  ArrowUpRight,
  ArrowRight,
  GraduationCap,
  Globe2,
  Layers,
  Scale,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useData } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { coverageOf } from "../analytics/quality";
import { Header, Card, Stat, short, fmt, colors } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import type { Config } from "../types";
import { GlobalTeaser } from "./Global";

export function Overview() {
  const { academics, universities, metadata, summary } = useData();
  const { filters, configure, setFilters } = useAtlas();
  const nav = useNavigate(),
    rows = filterAcademics(academics, filters);
  const filtered = rows.length !== academics.length;
  const groups = universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const ranks = groupRows(rows, "rank").sort(
    (a, b) => b.rows.length - a.rows.length,
  );
  const cov = coverageOf(rows);
  const pct = (n: number) =>
    rows.length ? fmt((100 * n) / rows.length, 1) + "%" : "—";
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
  const questions = [
    {
      icon: GraduationCap,
      q: "How do academic qualifications differ between institutions?",
      sub: "Share of documented doctorates among records with documented qualifications.",
      go: () =>
        preset({
          level: "university",
          metric: "phd",
          aggregation: "percentage",
          chart: "bar",
          sort: "value",
        }),
    },
    {
      icon: Globe2,
      q: "Where did Sri Lankan academics obtain their PhDs?",
      sub: "Awarding countries and institutions, by institution, position and discipline.",
      go: () => nav("/origins"),
    },
    {
      icon: Layers,
      q: "How do fields and academic ranks differ?",
      sub: "Position and qualification composition of each institution.",
      go: () =>
        preset({
          level: "university",
          metric: "count",
          aggregation: "total",
          chart: "percentStacked",
        }),
    },
    {
      icon: Scale,
      q: "How does Sri Lanka compare internationally using equivalent metrics?",
      sub: "QS 2027 tier samples, OpenAlex on both sides, equivalent disciplines.",
      go: () => nav("/global"),
    },
  ];
  return (
    <>
      <Header
        eyebrow="Sri Lanka · Academic research atlas"
        title="A clearer view of our academic landscape."
        description="A transparent, evidence-linked collection of published academic profiles from Sri Lankan universities, with international benchmarks and reproducible comparisons."
        action={
          <Button onClick={() => preset({})}>
            Open Comparison Studio
            <ArrowUpRight size={18} />
          </Button>
        }
      />
      <div className="overview-band">
        <div>
          <span className="status-dot" /> Snapshot{" "}
          {summary?.version || metadata.version} · collected{" "}
          {metadata.collectionDate}
          {filtered && " · global filters applied"}
        </div>
        <Link to="/methodology">
          How the data were collected <ArrowRight size={16} />
        </Link>
      </div>
      <div className="stats-grid snapshot">
        <Stat
          label="Academics collected"
          value={fmt(rows.length)}
          detail="Published profiles — not the total academic population"
        />
        <Stat
          label="Institutions covered"
          value={`${groups.filter((g) => g.rows.length).length} of ${universities.length}`}
          detail="Institutions in scope with collected profiles"
        />
        <Stat
          label="Faculties · departments"
          value={`${new Set(rows.map((a) => a.facultyId).filter(Boolean)).size} · ${new Set(rows.map((a) => a.departmentId).filter(Boolean)).size}`}
          detail="Units represented in the collected profiles"
        />
        <Stat
          label="Verified research identities"
          value={fmt(cov.verifiedIdentity)}
          detail={`${pct(cov.verifiedIdentity)} linked from an official page · ${fmt(cov.verifiedEmployment)} verified employment`}
        />
        <Stat
          label="Data completeness"
          value={pct(cov.withMetric)}
          detail={`Any research metric · qualifications ${pct(cov.withQualifications)} · ${fmt(cov.needsReview)} need review`}
        />
        <Stat
          label="International benchmarks"
          value={fmt(summary?.internationalBenchmarks.academics ?? null)}
          detail={
            summary
              ? `Sampled academics · ${summary.internationalBenchmarks.universities} universities · ${summary.internationalBenchmarks.countries} countries`
              : "Not loaded"
          }
        />
      </div>
      <section aria-label="Research questions" className="research-questions">
        <h2>Start with a research question</h2>
        <div className="question-grid">
          {questions.map(({ icon: Icon, q, sub, go }) => (
            <button key={q} className="question-card" onClick={go}>
              <span className="preset-icon">
                <Icon size={22} />
              </span>
              <span>
                <strong>{q}</strong>
                <small>{sub}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <div className="two-columns align-start">
        <Card
          title="Collected profiles by institution"
          subtitle="Number of collected records — directory coverage differs between institutions, so these are not staff totals. Click an institution to explore."
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
            label="Collected academic profiles by institution"
            onClick={(p) =>
              p.data?.universityId && nav("/university/" + p.data.universityId)
            }
          />
        </Card>
        <Card
          title="Academic positions"
          subtitle="Normalised positions; original titles are retained in each profile."
        >
          <Chart
            height={260}
            label="Academic positions in the collected profiles"
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
      </div>
      <Card
        title="Qualifications across institutions"
        subtitle="Highest documented qualification as a share of collected profiles. PhD counts only documented completed doctorates; contradictory or in-progress doctorates are not counted. Unknown stays visible."
      >
        <Chart
          height={350}
          label="Qualification composition by institution"
          option={{
            tooltip: { trigger: "axis", renderMode: "richText" },
            legend: { top: 0, textStyle: { fontSize: 14 } },
            grid: { left: 60, right: 20, top: 55, bottom: 80 },
            xAxis: {
              type: "category",
              data: groups.map((g) => `${g.short}`),
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
        <p className="caption">
          Institutions with no collected profiles show no bars; this does not
          mean they have no academic staff.
        </p>
      </Card>
      <GlobalTeaser />
      <Card
        title="Explore an institution"
        subtitle="Follow the hierarchy from university to faculty, department and academic. Each view shows its own data coverage."
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
                    ? g.rows.length +
                      (g.rows.length === 1 ? " profile" : " profiles")
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
