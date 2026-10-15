import {
  ArrowUpRight,
  ArrowRight,
  GraduationCap,
  Globe2,
  Layers,
  Scale,
  Building2,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useData } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import { groupRows } from "../analytics/engine";
import { coverageOf } from "../analytics/quality";
import { Card, Stat, fmt, colors } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import type { Config } from "../types";
import { GlobalTeaser } from "./Global";

export function Overview() {
  const [qualificationScale, setQualificationScale] = useState<"share" | "count">("share");
  const { academics, universities, summary } = useData();
  const { configure, setFilters } = useAtlas();
  const nav = useNavigate(),
    rows = academics;
  const groups = universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const positionOrder = ["Senior Professor", "Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer", "Lecturer", "Assistant Lecturer", "Instructor", "Librarian", "Other", "Unknown"];
  const positionIndex = (rank: string) => { const index = positionOrder.indexOf(rank); return index < 0 ? positionOrder.length - 2 : index; };
  const ranks = groupRows(rows, "rank").sort((a, b) => positionIndex(a.id) - positionIndex(b.id));
  const rankColor = (rank: string) => rank === "Unknown" ? "#9aa8b5" : rank === "Other" ? "#768591" : colors[positionIndex(rank) % colors.length];
  const cov = coverageOf(rows);
  const phdCount = rows.filter((a) => a.qualification === "PhD").length;
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
            color: g.type === "Public" ? "#3b4fd6" : "#0f9488",
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
      <section className="hero" aria-label="Atlas summary">
        <span
          className="hero-corner"
          title={`Any research metric ${pct(cov.withMetric)} · qualifications ${pct(cov.withQualifications)} · ${fmt(cov.needsReview)} need review`}
        >
          <i className="status-dot" />
          Data completeness {pct(cov.withMetric)}
        </span>
        <div className="hero-copy">
          <div className="eyebrow">Sri Lanka · Academic research atlas</div>
          <h1>Sri Lanka’s academic landscape.</h1>
          <p>
            Explore academics, qualifications and research — across Sri Lanka
            and beyond.
          </p>
          <div className="hero-actions">
            <Button onClick={() => nav("/universities")}>
              Browse universities
              <ArrowUpRight size={18} />
            </Button>
            <Button variant="outline" onClick={() => preset({})}>
              Compare institutions
            </Button>
            <Link className="hero-link" to="/methodology">
              How the data were collected <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-facts">
          <div className="hero-fact lead">
            <span>Academics collected</span>
            <strong>{fmt(rows.length)}</strong>
            <small>Published profiles — not the total academic population</small>
          </div>
          <div className="hero-fact">
            <span>Institutions covered</span>
            <strong>{`${groups.filter((g) => g.rows.length).length} of ${universities.length}`}</strong>
          </div>
          <div className="hero-fact">
            <span>Documented PhD</span>
            <strong>{pct(phdCount)}</strong>
          </div>
          <div className="hero-fact">
            <span>Verified research identities</span>
            <strong>{fmt(cov.verifiedIdentity)}</strong>
            <small>{pct(cov.verifiedIdentity)} of profiles</small>
          </div>
        </div>
      </section>
      <div className="stats-grid snapshot">
        <Stat
          label="Faculties · departments"
          value={`${new Set(rows.map((a) => a.facultyId).filter(Boolean)).size} · ${new Set(rows.map((a) => a.departmentId).filter(Boolean)).size}`}
          detail="Units represented in the collected profiles"
        />
        <Stat
          label="Verified employment"
          value={fmt(cov.verifiedEmployment)}
          detail={`${fmt(cov.needsReview)} profiles need review`}
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
          subtitle="Click a bar to explore the institution’s collected profiles."
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
          subtitle="Senior to junior · collected profiles"
        >
          <ul className="position-bars" aria-label="Academic positions, senior to junior">
            {ranks.map((g) => {
              const share = rows.length ? 100 * g.rows.length / rows.length : 0;
              const largest = Math.max(1, ...ranks.map(r => r.rows.length));
              return <li key={g.id}><button onClick={() => preset({ level: "rank", groups: [g.id] })}>
                <span className="position-bar-label">{g.label}</span>
                <strong>{g.rows.length.toLocaleString()}</strong><span className="position-share">{share.toFixed(1)}%</span>
                <span className="position-track"><span style={{ width: `${100 * g.rows.length / largest}%`, background: rankColor(g.id) }} /></span>
              </button></li>;
            })}
          </ul>
        </Card>
      </div>
      <Card
        title="Qualifications across institutions"
        subtitle="Highest recorded qualification. PhD means a documented completed doctorate."
        action={
          <div className="chart-scale-toggle" role="group" aria-label="Qualification chart scale">
            {(["share", "count"] as const).map((scale) => (
              <button type="button" key={scale} aria-pressed={qualificationScale === scale} onClick={() => setQualificationScale(scale)}>
                {scale === "share" ? "Share (%)" : "Count"}
              </button>
            ))}
          </div>
        }
      >
        <Chart
          height={350}
          label={`Qualification ${qualificationScale === "share" ? "share (%)" : "count"} by institution`}
          option={{
            tooltip: {
              trigger: "axis", renderMode: "richText", confine: true,
              formatter: (params: any[]) => {
                const group = groups[params[0]?.dataIndex];
                if (!group) return "";
                return `${group.name}: ${group.rows.length} profiles\n` + params.map((p) => {
                  const count = group.rows.filter((a) => a.qualification === p.seriesName).length;
                  return `${p.seriesName}: ${count} (${group.rows.length ? (100 * count / group.rows.length).toFixed(1) : "0.0"}%)`;
                }).join("\n");
              },
            },
            legend: { top: 0, textStyle: { fontSize: 14 } },
            grid: { left: 60, right: 20, top: 55, bottom: 80 },
            xAxis: {
              type: "category",
              data: groups.map((g) => `${g.short}`),
              axisLabel: { fontSize: 14, rotate: 35 },
            },
            yAxis: { type: "value", max: qualificationScale === "share" ? 100 : undefined, minInterval: qualificationScale === "count" ? 1 : undefined, name: qualificationScale === "share" ? "Percent" : "Profiles" },
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
                  ? g.rows.filter((a) => a.qualification === q).length *
                    (qualificationScale === "share" ? 100 / g.rows.length : 1)
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
      <Link to="/universities" className="universities-cta">
        <span className="preset-icon">
          <Building2 size={28} strokeWidth={1.8} />
        </span>
        <span>
          <strong>Explore the universities</strong>
          <small>
            {universities.length} institutions — profiles, PhD shares and
            research output side by side.
          </small>
        </span>
        <ArrowRight size={20} />
      </Link>
    </>
  );
}
