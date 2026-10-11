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
  const { academics, universities, summary } = useData();
  const { filters, configure, setFilters } = useAtlas();
  const nav = useNavigate(),
    rows = filterAcademics(academics, filters);
  const groups = universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const positionOrder = ["Senior Professor", "Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer", "Lecturer", "Assistant Lecturer", "Instructor", "Librarian", "Other", "Unknown"];
  const positionIndex = (rank: string) => { const index = positionOrder.indexOf(rank); return index < 0 ? positionOrder.length - 2 : index; };
  const ranks = groupRows(rows, "rank").sort((a, b) => positionIndex(a.id) - positionIndex(b.id));
  const rankColor = (rank: string) => rank === "Unknown" ? "#9aa8b5" : rank === "Other" ? "#768591" : colors[positionIndex(rank) % colors.length];
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
      q: "Qualifications",
      sub: "Compare documented PhD shares.",
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
      q: "PhD origins",
      sub: "Explore countries and universities.",
      go: () => nav("/origins"),
    },
    {
      icon: Layers,
      q: "Academic positions",
      sub: "Compare roles across institutions.",
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
      q: "Global benchmarks",
      sub: "Compare equivalent fields worldwide.",
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
        <h2>Explore the atlas</h2>
        <div className="question-grid">
          {questions.map(({ icon: Icon, q, sub, go }) => (
            <button key={q} className="question-card" onClick={go}>
              <span className="preset-icon">
                <Icon size={28} strokeWidth={1.8} />
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
      <div className="two-columns overview-distributions">
        <Card
          title="Collected profiles by institution"
          subtitle="Collected records, not total staff. Select an institution to explore."
          action={
            <span className="legend-inline institution-key">
              <i className="blue" />
              Public <i className="teal" />
              Non-state
            </span>
          }
        >
          <Chart
            option={barOption}
            height={520}
            label="Collected academic profiles by institution"
            onClick={(p) =>
              p.data?.universityId && nav("/university/" + p.data.universityId)
            }
          />
        </Card>
        <Card
          title="Academic positions"
          subtitle="Senior to junior academic roles. Other roles and unrecorded positions follow."
        >
          <Chart
            height={210}
            label="Academic positions in the collected profiles"
            option={{
              tooltip: { renderMode: "richText" },
              legend: { show: false },
              series: [
                {
                  type: "pie",
                  radius: ["53%", "83%"],
                  center: ["50%", "50%"],
                  label: { show: false },
                  data: ranks.map((g) => ({
                    name: g.label,
                    value: g.rows.length,
                    itemStyle: { color: rankColor(g.id) },
                  })),
                },
              ],
            }}
            onClick={(p) => {
              preset({ level: "rank", groups: [p.name] });
            }}
          />
          <div className="position-legend-heading"><span>Position</span><span>Profiles · share</span></div>
          <ul className="position-legend" aria-label="Academic position legend">
            {ranks.map((g, i) => (
              <li key={g.id}>
                <button
                  aria-label={`${g.label}: ${g.rows.length} profiles, ${rows.length ? ((100 * g.rows.length) / rows.length).toFixed(1) : "0.0"} percent. Compare this position`}
                  onClick={() => preset({ level: "rank", groups: [g.id] })}
                >
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: rankColor(g.id) }}
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
