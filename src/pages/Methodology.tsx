import type { ReactNode } from "react";
import { Database, ShieldCheck, Globe2, Gauge, TriangleAlert, type LucideIcon } from "lucide-react";
import { useData, comparableUniversities } from "../data/context";
import { InstitutionNotice } from "../components/InstitutionNotice";
import { filterAcademics, completeness } from "../analytics/engine";
import { MIN_SAMPLE, WEAK_COVERAGE } from "../analytics/quality";
import { useAtlas } from "../store";
import { Header, Card, fmt, short } from "../components/common";
import { Chart } from "../components/Chart";
import { heatDatum, heatVisualMap } from "../analytics/heatmap";
import type { Academic } from "../types";

const PUBLIC_DOWNLOADS = [
  ["academics.csv", "Academic records (public fields)"],
  ["universities.csv", "Institutions in scope"],
  ["faculties.csv", "Faculties"],
  ["departments.csv", "Departments"],
  ["coverage_summary.csv", "Coverage indicators by institution"],
  ["dataset_summary.json", "Snapshot summary"],
  ["data_dictionary.csv", "Field definitions"],
  ["metadata.json", "Dataset metadata"],
  ["field-mapping.json", "Manual field mapping"],
  ["international/academics.csv", "International benchmark samples"],
  ["international/universities.csv", "Benchmark universities"],
  ["international/departments.csv", "Benchmark departments and proxy flags"],
  ["international/publications.csv", "Source-listed international bibliographies"],
  ["international/sri_lanka_openalex.csv", "Sri Lankan OpenAlex lookup results"],
];

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="method-section">
      <h3>
        <span className="method-icon" aria-hidden="true"><Icon size={16} /></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Methodology() {
  const d = useData(),
    f = useAtlas((s) => s.filters),
    rows = filterAcademics(d.academics, f);
  const minN = d.metadata.minimumSample || MIN_SAMPLE;
  const fields: [keyof Academic, string][] = [
    ["qualifications", "Qualifications"],
    ["phdUniversity", "PhD institution"],
    ["phdCountry", "PhD country"],
    ["phdYear", "PhD year"],
    ["experience", "Experience"],
    ["interests", "Interests"],
    ["publications", "Publications"],
    ["citations", "Citations"],
    ["recentCitations", "5-year citations"],
    ["hIndex", "h-index"],
  ];
  const groups = d.universities.map((u) => ({
    ...u,
    rows: rows.filter((a) => a.universityId === u.id),
  }));
  const pct = (n: number, of: number) =>
    of ? fmt((100 * n) / of, 1) + "%" : "—";
  return (
    <>
      <Header
        eyebrow="Transparency by design"
        title="Data & Methodology"
        description="How the collection was built, how statistics are calculated, and where evidence is missing."
      />
      <section className="method-glance" aria-label="Collection at a glance">
        <div><strong>{fmt(rows.length)}</strong><span>profiles in view</span></div>
        <div><strong>{comparableUniversities(d.universities).filter((u) => d.academics.some((a) => a.universityId === u.id)).length} / {comparableUniversities(d.universities).length}</strong><span>institutions covered</span></div>
        <div><strong>{pct(rows.filter((a) => a.researchObservations?.length || a.scholarStatus === "verified_official_link" || a.scholarStatus === "matched_user_supplied_platform_evidence" || a.openAlexUrl).length, rows.length)}</strong><span>research identity linked</span></div>
        <div><strong>{pct(rows.filter((a) => a.citations !== null || a.hIndex !== null).length, rows.length)}</strong><span>with citation data</span></div>
        <div><strong>{d.metadata.collectionDate}</strong><span>collected</span></div>
      </section>
      {d.universities.filter((u) => u.notice).map((u) => (
        <InstitutionNotice key={u.id} university={u} />
      ))}
      <p className="method-lede">A partial collection of public profiles, not a staff census. Missing values are unknown, never zero.</p>
      <Card
        title="Coverage by institution"
        subtitle="Three separate questions: how much of the directory was found, whose research identity is confirmed, and who has research numbers. High in one says nothing about the others."
      >
        <div className="table-scroll">
          <table className="coverage-table coverage-v2">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Profiles</th>
                <th>Directory visited</th>
                <th>Identity verified</th>
                <th>Employment verified</th>
                <th>Has metrics</th>
                <th>To review</th>
              </tr>
            </thead>
            <tbody>
              {[...d.coverage]
                .sort((x, y) => y.academic_records - x.academic_records)
                .map((c) => {
                  const bar = (n: number) => {
                    const v = c.academic_records ? (100 * n) / c.academic_records : 0;
                    return (
                      <span className="cov-cell" title={`${n} of ${c.academic_records}`}>
                        <b>{Math.round(v)}%</b>
                        <i><u style={{ width: `${v}%` }} /></i>
                      </span>
                    );
                  };
                  return (
                    <tr key={c.university_id}>
                      <th scope="row" title={c.university}>{short(c.university)}</th>
                      <td>{fmt(c.academic_records)}</td>
                      <td title={c.roster_status}>
                        {c.units_discovered
                          ? `${c.units_visited} / ${c.units_discovered} units`
                          : "No inventory"}
                      </td>
                      <td>{bar(c.verified_identity)}</td>
                      <td>{bar(c.verified_employment)}</td>
                      <td>{bar(c.with_any_metric)}</td>
                      <td>{c.needs_review || "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="caption">
          "Directory visited" is how many of an institution's discovered faculties,
          departments and units were checked. The size of each institution's whole
          academic staff is unknown, so no census percentage is given.
        </p>
      </Card>
      <Card
        title="What is filled in, by institution"
        subtitle="Share of each institution's collected profiles that have a value. Institutions with no records are left blank."
      >
        <Chart
          height={Math.max(420, groups.length * 40 + 190)}
          minWidth={760}
          label="Heatmap of field completeness by institution"
          option={{
            tooltip: {
              confine: true,
              formatter: (p: any) =>
                `${groups[p.value[1]].name}\n${fields[p.value[0]][1]}: ${Number(p.data.pct).toFixed(1)}%\nCollected profiles: ${groups[p.value[1]].rows.length}`,
            },
            grid: { left: 10, right: 20, top: 56, bottom: 70, containLabel: true },
            xAxis: {
              type: "category",
              position: "top",
              data: fields.map((f) => f[1]),
              axisLabel: { fontSize: 12, rotate: 30, interval: 0 },
              axisTick: { show: false },
            },
            yAxis: {
              type: "category",
              inverse: true,
              data: groups.map((u) => `${u.short} (${u.rows.length})`),
              axisLabel: { fontSize: 13 },
            },
            visualMap: heatVisualMap(100, ["All filled in", "None"]),
            series: [
              {
                type: "heatmap",
                data: groups.flatMap((g, y) =>
                  fields.flatMap(([f], x) =>
                    g.rows.length
                      ? [heatDatum(x, y, completeness(g.rows, f) ?? 0, { pct: completeness(g.rows, f) ?? 0 })]
                      : [],
                  ),
                ),
                label: {
                  show: true,
                  fontSize: 12,
                  formatter: (p: any) => (p.data.pct < 0.5 ? "–" : Math.round(p.data.pct) + "%"),
                },
              },
            ],
          }}
        />
      </Card>
      <Card title="Research methodology">
        <div className="method-sections concise-methods">
          <Section title="Scope & collection" icon={Database}>
            <ul>
              <li><b>14</b> Sri Lankan institutions; public and non-state shown separately</li>
              <li><b>Official</b> staff pages only, with source links and dates</li>
              <li><b>Partial</b> coverage; confirmed duplicates share one ID</li>
            </ul>
          </Section>
          <Section title="Verification" icon={ShieldCheck}>
            <ul>
              <li><b>Identity:</b> research profile linked from an official page; unclear matches stay blank</li>
              <li><b>Employment:</b> official source must state permanent or emeritus</li>
              <li><b>PhD:</b> explicit evidence needed; a title alone does not count</li>
            </ul>
          </Section>
          <Section title="Sources & benchmarks" icon={Globe2}>
            <ul>
              <li><b>Metrics:</b> Google Scholar, ResearchGate, OpenAlex, one provider at a time</li>
              <li><b>International:</b> 7 countries, 3 QS 2027 tiers, up to 25 people per department</li>
              <li><b>Newer disciplines</b> (Medicine, Engineering, Law, Management, Business) cover selected units only</li>
              <li>Unverified identities stay blank; substitute disciplines are flagged and excluded by default</li>
            </ul>
          </Section>
          <Section title="Research standing score" icon={Gauge}>
            <ul>
              <li><b>0–100:</b> position among comparable collected profiles</li>
              <li><b>Peers:</b> same career stage, discipline and data source</li>
              <li><b>Blend:</b> h-index 40%, citations 2021–2025 35%, publications 25%</li>
              <li>Missing measures are skipped; thin data is labelled indicative</li>
            </ul>
          </Section>
          <Section title="Read results with care" icon={TriangleAlert}>
            <ul>
              <li>Missing is never zero; coverage below {WEAK_COVERAGE}% is flagged</li>
              <li>Public profiles may over-represent research-active staff</li>
              <li>Scores do not measure teaching or overall quality</li>
            </ul>
          </Section>
        </div>
        <section className="statistical-methods" aria-labelledby="statistical-methods-title">
          <h3 id="statistical-methods-title">Statistical methods</h3>
          <div className="table-scroll">
            <table className="methods-table">
              <thead><tr><th scope="col">Method</th><th scope="col">Calculation / rule</th></tr></thead>
              <tbody>
                <tr><th scope="row">Valid sample</th><td>Available finite values, including recorded zeros. Fewer than {minN}: flagged, never ranked.</td></tr>
                <tr><th scope="row">Mean & quartiles</th><td>Mean = sum ÷ valid count. Quantiles interpolate at (n − 1) × p; whiskers show min–max.</td></tr>
                <tr><th scope="row">Log scale</th><td>Zeros are omitted and counted beside the plot; statistics still include them.</td></tr>
                <tr><th scope="row">Percentiles</th><td>100 × (values below + ½ ties) ÷ valid peers. Hidden below five peers.</td></tr>
                <tr><th scope="row">Research standing</th><td>Weighted blend of percentiles (h-index 40%, citations 2021–2025 35%, publications 25%) within the same career stage × broad discipline and the same source. Missing measures are skipped, never zero; thin data gives a labelled indicative score. Click a score on a profile for the calculation.</td></tr>
                <tr><th scope="row">PhD share</th><td>Completed doctorates ÷ documented qualifications. Overseas share uses doctorates with a known country.</td></tr>
                <tr><th scope="row">University weighting</th><td>Equal weight = mean of available university statistics; missing universities are excluded and counted.</td></tr>
                <tr><th scope="row">h-index</th><td>Never summed across academics.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <details className="method-details">
          <summary>Collection limitations</summary>
          <ul>{d.metadata.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <p>Awarding country identifies the institution, not necessarily where the person studied.</p>
        </details>
        <div className="method-corrections">
          <strong>Corrections or removal</strong>
          <p>Contact {d.metadata.correctionContact ? <a href={`mailto:${d.metadata.correctionContact}`}>{d.metadata.correctionContact}</a> : "the project maintainer through the repository"}. Changes retain their source and history privately. <a href="https://github.com/maninka123/academic-lens-lk/blob/main/docs/DATA_POLICY.md" target="_blank" rel="noreferrer">Data policy</a></p>
        </div>
      </Card>
      <Card title="Published files">
        <p>
          The website publishes only the files below (a documented allowlist).
          Internal evidence, identity reviews and collection logs are kept
          privately with the research data.
        </p>
        <div className="source-links inline">
          {PUBLIC_DOWNLOADS.map(([f, label]) => (
            <a
              className="text-link"
              key={f}
              href={import.meta.env.BASE_URL + "data/" + f}
              download
              title={label}
            >
              {f}
            </a>
          ))}
        </div>
        <p className="caption">
          World map: Natural Earth boundaries via{" "}
          <a
            href="https://github.com/topojson/world-atlas"
            target="_blank"
            rel="noreferrer"
          >
            world-atlas
          </a>
          , bundled locally; geopolitical boundaries are illustrative.
        </p>
      </Card>
    </>
  );
}
