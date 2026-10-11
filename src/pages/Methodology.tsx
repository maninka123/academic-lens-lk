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
      <Card
        title="Collection status"
        subtitle={`Dataset version ${d.metadata.version} · collected ${d.metadata.collectionDate}`}
      >
        <div className="methodology-intro">
          <strong>
            Partial collection of published profiles — not a census of
            academic staff
          </strong>
          <p>{d.metadata.description}</p>
          <p>{d.metadata.scopeNote}</p>
          <p>
            Active filtered records: {fmt(rows.length)}. All counts on this
            site are calculated from the loaded records; the README and the
            validation report are regenerated from the same snapshot at import.
          </p>
        </div>
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
        <div className="method-sections">
          <Section title="Institutional selection">
            <p>
              Fourteen Sri Lankan universities and campuses were selected for
              the collection (Saegis Campus excluded). Public and non-state
              institutions are labelled separately. International benchmark
              universities were selected from the QS World University Rankings
              2027 (see Global Benchmarks).
            </p>
          </Section>
          <Section title="Staff inclusion and exclusion">
            <p>
              Included: people listed as academic staff in official
              university directories or profiles. A listing is not proof of
              current permanent employment; employment is marked verified only
              when an official source states a permanent or emeritus
              appointment. Confirmed duplicate identities are merged through
              documented aliases; existing academic IDs never change.
            </p>
          </Section>
          <Section title="Data collection process">
            <p>
              Official directories and individual profile pages were read and
              recorded with source URLs and dates. Published names, titles and
              qualifications are kept as source text. Units that could not be
              reached are recorded privately; an empty unit does not mean it has
              no staff.
            </p>
          </Section>
          <Section title="Researcher identity matching">
            <p>
              A research profile counts as a verified identity only when it is
              linked from an official university page. Other recorded links are
              shown as unverified; rejected matches are never used. For
              OpenAlex, researchers are matched by name within their
              institution; ambiguous or merged profiles are left blank, and an
              attempted lookup is never counted as a match.
            </p>
          </Section>
          <Section title="Academic qualification verification">
            <p>
              A completed doctorate is counted only with explicit evidence: a
              documented completion status or qualification text naming the
              doctorate. Titles such as Dr or Professor, a recorded doctoral
              institution, or ambiguous text are not treated as completion.
              Contradictory records (for example, completion recorded while the
              text describes an ongoing PhD) are flagged for review and not
              counted. Display names show Dr* only with documented evidence and
              otherwise use the source's own honorific, never an inferred one.
            </p>
          </Section>
          <Section title="Bibliometric sources">
            <p>
              Sri Lankan metrics come mainly from Google Scholar (citations,
              h-index) and ResearchGate snapshots (publications, some
              citations); international benchmarks use OpenAlex. Providers
              report different counts and are never combined in a primary
              comparison: statistics use one provider at a time, and
              mixed-provider views are labelled exploratory. Each value keeps
              its provider and retrieval date.
            </p>
          </Section>
          <Section title="International sampling">
            <p>
              Two universities per QS tier (elite, middle, lower) in seven
              countries, with Computer Science and Physics rosters sampled
              systematically (up to 25 per department). Samples are not
              national censuses. Proxy units that stand in for a missing
              discipline are flagged and excluded by default.
            </p>
          </Section>
          <Section title="Data completeness and bias">
            <p>
              Coverage varies strongly between institutions and fields. Research
              metrics are more often available for staff with public research
              profiles, so metric summaries may over-represent research-active
              academics. Comparisons show eligible records, valid values and
              completeness beside each result; coverage below {WEAK_COVERAGE}%
              is flagged as weak.
            </p>
          </Section>
          <Section title="Statistical methods">
            <dl className="info-list">
              <div>
                <dt>Valid sample size</dt>
                <dd>
                  Only finite, available numeric values contribute. Missing is
                  null, never zero; an explicit zero is included. Groups with
                  fewer than {minN} valid values are flagged and never ranked.
                </dd>
              </div>
              <div>
                <dt>Mean, median and quartiles</dt>
                <dd>
                  Mean is sum ÷ valid count. Quantiles use linear interpolation
                  at position (n − 1) × p. Box whiskers show observed minimum and
                  maximum.
                </dd>
              </div>
              <div>
                <dt>Logarithmic scales</dt>
                <dd>
                  Zero values cannot be drawn on a log axis; they are left out of
                  the chart (never shifted to 1), counted beside the chart, and
                  kept in all statistics.
                </dd>
              </div>
              <div>
                <dt>Percentiles</dt>
                <dd>
                  100 × (values below + half of tied values) ÷ valid peers;
                  suppressed below 5 valid peers.
                </dd>
              </div>
              <div>
                <dt>PhD percentages</dt>
                <dd>
                  Documented completed doctorates ÷ records with documented
                  qualifications; overseas share uses documented doctorates
                  with a known awarding country.
                </dd>
              </div>
              <div>
                <dt>Equal university weight</dt>
                <dd>
                  The mean of available university statistics; universities
                  without valid data are excluded and counted.
                </dd>
              </div>
              <div>
                <dt>No composite scores</dt>
                <dd>
                  No overall academic performance score is calculated.
                  h-index values are never summed.
                </dd>
              </div>
            </dl>
          </Section>
          <Section title="Limitations">
            <ul className="limitations">
              {d.metadata.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
              <li>
                Research fields have different citation patterns; citation
                counts are not an assessment of academic or teaching quality.
              </li>
              <li>Q1 policy: {d.metadata.q1Methodology.split("\n")[0]}</li>
            </ul>
          </Section>
          <Section title="Updates, corrections and removal requests">
            <p>
              Records are corrected when better official evidence is found;
              every correction keeps its previous value and source privately.
              Academics may ask for a factual correction or for their profile to
              be removed from the published site.
              {d.metadata.correctionContact
                ? ` Contact: ${d.metadata.correctionContact}.`
                : " Contact the project maintainer through the project repository."}{" "}
              See <code>docs/DATA_POLICY.md</code> for attribution, reuse
              conditions and the correction process.
            </p>
          </Section>
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
