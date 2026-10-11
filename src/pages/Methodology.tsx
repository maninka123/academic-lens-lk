import type { ReactNode } from "react";
import { useData } from "../data/context";
import { filterAcademics, completeness } from "../analytics/engine";
import { MIN_SAMPLE, WEAK_COVERAGE } from "../analytics/quality";
import { useAtlas } from "../store";
import { Header, Card, fmt } from "../components/common";
import { Chart } from "../components/Chart";
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
];

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="method-section">
      <h3>{title}</h3>
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
    ["q1", "Q1"],
    ["recentQ1", "5-year Q1"],
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
      <Card title="Collection status" subtitle="Partial collection of public profiles—not a staff census.">
        <dl className="collection-facts">
          <div><dt>Profiles in view</dt><dd>{fmt(rows.length)}</dd></div>
          <div><dt>Institutions covered</dt><dd>{d.universities.filter((u) => d.academics.some((a) => a.universityId === u.id)).length} / {d.universities.length}</dd></div>
          <div><dt>Collected</dt><dd>{d.metadata.collectionDate}</dd></div>
        </dl>
      </Card>
      <Card
        title="Three kinds of completeness"
        subtitle="Roster coverage, identity verification and metric availability are separate questions. A high value in one says nothing about the others."
      >
        <div className="table-scroll">
          <table className="coverage-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Collected records</th>
                <th>Roster coverage</th>
                <th>Verified identity</th>
                <th>Verified employment</th>
                <th>Any research metric</th>
                <th>Needs review</th>
              </tr>
            </thead>
            <tbody>
              {d.coverage.map((c) => (
                <tr key={c.university_id}>
                  <td>{c.university}</td>
                  <td>{fmt(c.academic_records)}</td>
                  <td>
                    {c.units_discovered
                      ? `${c.units_visited} of ${c.units_discovered} discovered units visited`
                      : "No unit inventory"}
                    <small className="caption"> · {c.roster_status}</small>
                  </td>
                  <td>
                    {pct(c.verified_identity, c.academic_records)} (
                    {c.verified_identity})
                  </td>
                  <td>
                    {pct(c.verified_employment, c.academic_records)} (
                    {c.verified_employment})
                  </td>
                  <td>
                    {pct(c.with_any_metric, c.academic_records)} (
                    {c.with_any_metric})
                  </td>
                  <td>{c.needs_review}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption">
          Roster coverage describes how much of each institution's published
          directory structure was found and visited. The total academic
          population of each institution is not known, so no census percentage
          is reported.
        </p>
      </Card>
      <Card
        title="Field completeness by institution"
        subtitle="Percentage of collected profiles with an available value. A missing cell has no records as denominator."
      >
        <Chart
          height={500}
          label="Heatmap of field completeness by institution"
          option={{
            tooltip: {
              renderMode: "richText",
              formatter: (p: any) =>
                `${groups[p.value[1]].name}\n${fields[p.value[0]][1]}: ${Number(p.value[2]).toFixed(1)}%\nCollected records: ${groups[p.value[1]].rows.length}`,
            },
            grid: { left: 150, right: 30, top: 30, bottom: 135 },
            xAxis: {
              type: "category",
              data: fields.map((f) => f[1]),
              axisLabel: { fontSize: 14, rotate: 40 },
            },
            yAxis: {
              type: "category",
              data: groups.map((u) => u.short),
              axisLabel: { fontSize: 14 },
            },
            visualMap: {
              min: 0,
              max: 100,
              left: "center",
              bottom: 0,
              orient: "horizontal",
              inRange: { color: ["#eef2f5", "#99cccf", "#126b84"] },
              text: ["100% available", "0% available"],
              textStyle: { fontSize: 14 },
            },
            series: [
              {
                type: "heatmap",
                data: groups.flatMap((g, y) =>
                  fields.flatMap(([f], x) =>
                    g.rows.length ? [[x, y, completeness(g.rows, f)]] : [],
                  ),
                ),
                label: {
                  show: true,
                  fontSize: 14,
                  formatter: (p: any) => Math.round(p.value[2]) + "%",
                },
              },
            ],
          }}
        />
      </Card>
      <Card title="Research methodology">
        <div className="method-sections concise-methods">
          <Section title="Scope & collection">
            <ul>
              <li>14 Sri Lankan institutions in scope; public and non-state shown separately.</li>
              <li>Official staff directories and profiles, with source links and dates. Coverage is partial.</li>
              <li>Published names and qualifications are retained; confirmed duplicates use stable ID aliases.</li>
            </ul>
          </Section>
          <Section title="Verification">
            <ul>
              <li>Research identity: linked from an official university page. Ambiguous OpenAlex matches stay blank.</li>
              <li>Employment: an official source must state a permanent or emeritus appointment.</li>
              <li>Completed PhDs need explicit evidence. Titles alone do not count; conflicting records need review.</li>
            </ul>
          </Section>
          <Section title="Sources & benchmarks">
            <ul>
              <li>Google Scholar, ResearchGate and OpenAlex. Primary comparisons use one provider at a time.</li>
              <li>International sample: seven countries, three QS 2027 tiers, Computer Science and Physics; up to 25 people per department.</li>
              <li>Substitute disciplines are flagged and excluded by default.</li>
            </ul>
          </Section>
          <Section title="Read results with care">
            <ul>
              <li>Missing values are not zero. Coverage below {WEAK_COVERAGE}% is flagged.</li>
              <li>Public research profiles may over-represent research-active staff.</li>
              <li>Citations do not measure overall academic or teaching quality. No composite score is calculated.</li>
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
                <tr><th scope="row">PhD share</th><td>Completed doctorates ÷ documented qualifications. Overseas share uses doctorates with a known country.</td></tr>
                <tr><th scope="row">University weighting</th><td>Equal weight = mean of available university statistics; missing universities are excluded and counted.</td></tr>
                <tr><th scope="row">h-index</th><td>Never summed across academics.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <details className="method-details">
          <summary>Collection limitations & Q1 policy</summary>
          <ul>{d.metadata.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          <p>Awarding country identifies the institution, not necessarily where the person studied.</p>
          <p className="method-policy">{d.metadata.q1Methodology.replace(/^#+\s*/gm, "")}</p>
        </details>
        <div className="method-corrections">
          <strong>Corrections or removal</strong>
          <p>Contact {d.metadata.correctionContact || "the project maintainer through the repository"}. Changes retain their source and history privately. <a href="https://github.com/maninka123/academic-lens-lk/blob/main/docs/DATA_POLICY.md" target="_blank" rel="noreferrer">Data policy</a></p>
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
