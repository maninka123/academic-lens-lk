import { ArrowRight, ArrowUpRight, Building2, Users, Globe2, Scale, Database } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useData, comparableUniversities } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import { groupRows } from "../analytics/engine";
import { coverageOf } from "../analytics/quality";
import { Card, fmt, colors } from "../components/common";
import { Chart } from "../components/Chart";
import { Button } from "../components/ui/button";
import { OverviewLandscape } from "../components/OverviewLandscape";
import type { Config } from "../types";
import { GlobalTeaser } from "./Global";
import { StandardsOverview } from "../components/StandardsOverview";

export function Overview() {
  const [qualificationScale, setQualificationScale] = useState<"share" | "count">("share");
  const { academics, universities: allUniversities, summary } = useData();
  const universities = comparableUniversities(allUniversities);
  const { configure, setFilters } = useAtlas();
  const nav = useNavigate(),
    rows = academics;
  const groups = universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const positionOrder = ["Senior Professor", "Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer", "Lecturer", "Assistant Lecturer", "Instructor", "Librarian", "Other", "Unknown"];
  const positionIndex = (rank: string) => { const index = positionOrder.indexOf(rank); return index < 0 ? positionOrder.length - 2 : index; };
  // Profiles without a recorded position ("Unknown", "Other") are not drawn as a position.
  const ranks = groupRows(rows, "rank")
    .filter((g) => g.id !== "Unknown" && g.id !== "Other")
    .sort((a, b) => positionIndex(a.id) - positionIndex(b.id));
  const unplaced = rows.filter((a) => a.rank === "Unknown" || a.rank === "Other").length;
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
  const pathways = [
    { to: "/universities", title: "Universities", icon: Building2, text: `${universities.length} institutions: profiles, PhD shares and research output side by side.` },
    { to: "/academics", title: "Academics", icon: Users, text: "Search the directory, inspect the evidence behind a profile, compare people." },
    { to: "/origins", title: "PhD origins", icon: Globe2, text: "Where documented doctorates were awarded, by country, university and discipline." },
    { to: "/global", title: "Global benchmarks", icon: Scale, text: "Sri Lankan research output beside equivalent fields at overseas universities." },
    { to: "/methodology", title: "Data and methodology", icon: Database, text: "Sources, collection, coverage and how to request a correction." },
  ];
  return (
    <>
      <section className="overview-hero" aria-label="Introduction">
        <div className="hero-copy">
          <div className="eyebrow">Sri Lanka | Academic research</div>
          <h1>Sri Lanka’s academic landscape.</h1>
          <p>
            A research atlas of academics at {universities.length} institutions: their qualifications, positions and
            public research records, drawn from published staff lists.
          </p>
          <div className="hero-actions">
            <Button onClick={() => nav("/universities")}>
              Browse universities
              <ArrowUpRight size={16} />
            </Button>
            <Button variant="outline" onClick={() => preset({})}>
              Compare institutions
            </Button>
            <Link className="hero-link" to="/methodology">
              How the data were collected <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <OverviewLandscape groups={groups} />

      <dl className="fact-strip" aria-label="Collection at a glance">
        <div className="fact">
          <dt>Academics collected</dt>
          <dd>{fmt(rows.length)}</dd>
          <small>Published profiles, not the total academic population</small>
        </div>
        <div className="fact">
          <dt>Institutions covered</dt>
          <dd>{`${groups.filter((g) => g.rows.length).length} of ${universities.length}`}</dd>
          <small>{`${new Set(rows.map((a) => a.facultyId).filter(Boolean)).size} faculties | ${new Set(rows.map((a) => a.departmentId).filter(Boolean)).size} departments`}</small>
        </div>
        <div className="fact">
          <dt>Documented PhD</dt>
          <dd>{pct(phdCount)}</dd>
          <small>{`${fmt(cov.needsReview)} profiles need review`}</small>
        </div>
        <div className="fact">
          <dt>With research data</dt>
          <dd>{pct(cov.withMetric)}</dd>
          <small>{`${fmt(cov.verifiedIdentity)} verified research identities`}</small>
        </div>
      </dl>

      <div className="overview-block">
        <header className="block-head">
          <div className="eyebrow">People</div>
          <h2>Who is in the collection</h2>
          <p>Positions and qualifications as published. Institutions with no collected profiles show no bars; this does not mean they have no academic staff.</p>
        </header>
        <div className="two-columns overview-distributions">
          <Card
            title="Academic positions"
            subtitle={`Senior to junior | collected profiles${unplaced ? ` | ${unplaced.toLocaleString()} without a recorded position not shown` : ""}`}
          >
            <ul className="position-bars" aria-label="Academic positions, senior to junior">
              {ranks.map((g) => {
                const share = rows.length ? 100 * g.rows.length / rows.length : 0;
                const largest = Math.max(1, ...ranks.map(r => r.rows.length));
                return <li key={g.id}><button onClick={() => preset({ level: "rank", groups: [g.id] })}>
                  <span className="position-bar-label">{g.label}</span>
                  <strong>{g.rows.length.toLocaleString()}</strong><span className="position-share">{share.toFixed(1)}%</span>
                  <span className="position-track"><span style={{ width: `${100 * g.rows.length / largest}%` }} /></span>
                </button></li>;
              })}
            </ul>
          </Card>
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
              height={360}
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
                legend: { top: 0, itemGap: 12, padding: [0, 56, 0, 0] },
                grid: { left: 64, right: 12, top: 60, bottom: 74 },
                xAxis: {
                  type: "category",
                  data: groups.map((g) => `${g.short}`),
                  axisLabel: { rotate: 35 },
                },
                yAxis: { type: "value", max: qualificationScale === "share" ? 100 : undefined, minInterval: qualificationScale === "count" ? 1 : undefined, name: qualificationScale === "share" ? "Percent" : "Profiles", nameLocation: "middle", nameGap: 44 },
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
                  itemStyle: { color: q === "Unknown" ? "#aab1c2" : colors[i] },
                  data: groups.map((g) =>
                    g.rows.length
                      ? g.rows.filter((a) => a.qualification === q).length *
                        (qualificationScale === "share" ? 100 / g.rows.length : 1)
                      : null,
                  ),
                })),
              }}
            />
          </Card>
        </div>
      </div>

      <div className="overview-block">
        <header className="block-head">
          <div className="eyebrow">Research</div>
          <h2>Research output and international context</h2>
          <p>
            Output varies with seniority, discipline and how much of a person’s record is public. Read these as
            descriptions of the collected profiles, not as judgements of quality.
            {summary ? ` Benchmarks sample ${fmt(summary.internationalBenchmarks.academics)} academics at ${summary.internationalBenchmarks.universities} overseas universities.` : ""}
          </p>
        </header>
        <StandardsOverview />
        <GlobalTeaser />
      </div>

      <nav className="pathways" aria-label="Continue exploring">
        <h2>Continue exploring</h2>
        <ul>
          {pathways.map((p) => (
            <li key={p.to}>
              <Link to={p.to}>
                <span className="pathway-icon" aria-hidden="true"><p.icon size={20} /></span>
                <span className="pathway-text"><strong>{p.title}</strong><small>{p.text}</small></span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
