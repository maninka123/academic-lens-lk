import { useData } from "../data/context";
import { filterAcademics, completeness, groupRows } from "../analytics/engine";
import { useAtlas } from "../store";
import { Header, Card, fmt } from "../components/common";
import { Chart } from "../components/Chart";
import type { Academic } from "../types";
export function Methodology() {
  const d = useData(),
    f = useAtlas((s) => s.filters),
    rows = filterAcademics(d.academics, f);
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
  return (
    <>
      <Header
        eyebrow="Transparency by design"
        title="Data & Methodology"
        description="Understand what the collection contains, how statistics are calculated, and where evidence is missing."
      />
      <Card title="Collection status" subtitle={d.metadata.version}>
        <div className="methodology-intro">
          <strong>Partial real collection — factual review required</strong>
          <p>{d.metadata.description}</p>
          <p>{d.metadata.scopeNote}</p>
          <p>
            Collection: {d.metadata.collectionDate}. Active filtered records:{" "}
            {rows.length}. Numeric coverage below is calculated from the loaded
            CSV, so it may differ from older counts in the original collection
            README.
          </p>
        </div>
      </Card>
      <Card
        title="Field completeness by institution"
        subtitle="Percentage of collected profiles with an available value. A missing cell has no records as denominator."
      >
        <Chart
          height={500}
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Profiles</th>
                <th>Qualifications</th>
                <th>Citations</th>
                <th>Recent citations</th>
                <th>Q1</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.rows.length}</td>
                  {(
                    [
                      "qualifications",
                      "citations",
                      "recentCitations",
                      "q1",
                    ] as const
                  ).map((k) => (
                    <td key={k}>
                      {g.rows.length
                        ? fmt(completeness(g.rows, k), 1) + "%"
                        : "No collected records"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="two-columns">
        <Card title="Calculation rules">
          <dl className="info-list">
            <div>
              <dt>Valid sample size</dt>
              <dd>
                Only finite, available numeric values contribute. Missing is
                null, never zero. An explicit zero is included.
              </dd>
            </div>
            <div>
              <dt>Mean & median</dt>
              <dd>
                Mean is sum ÷ valid count. Median uses linear interpolation
                between the two central values when the sample count is even.
              </dd>
            </div>
            <div>
              <dt>Quartiles & IQR</dt>
              <dd>
                Sorted position = (n − 1) × p, linearly interpolated. IQR = 75th
                minus 25th percentile. Box plot whiskers show observed minimum
                and maximum, not Tukey fences.
              </dd>
            </div>
            <div>
              <dt>Standard deviation</dt>
              <dd>
                Population standard deviation: square root of the mean squared
                difference from the mean.
              </dd>
            </div>
            <div>
              <dt>Percentile ties</dt>
              <dd>
                100 × (values below + half of tied values) ÷ valid peers.
                Suppressed when valid n is less than 5.
              </dd>
            </div>
            <div>
              <dt>PhD percentages</dt>
              <dd>
                Recorded PhD holders ÷ records with documented qualifications.
                Unknowns are excluded from that denominator and retained in
                composition charts. Overseas percentages use recorded PhD
                holders with known country.
              </dd>
            </div>
            <div>
              <dt>Per 10 academics</dt>
              <dd>
                Combined available metric ÷ valid academic count × 10. Counts
                from coauthored work may be repeated.
              </dd>
            </div>
            <div>
              <dt>Equal university weight</dt>
              <dd>
                Calculate each university's chosen statistic, then take the
                arithmetic mean of available university statistics. Universities
                lacking valid data for the metric are excluded; valid university
                count is shown.
              </dd>
            </div>
          </dl>
        </Card>
        <div>
          <Card title="Research metric definitions">
            <p>
              Lifetime totals are the combined career metrics of academics in
              current listings. They are not the institution's historical
              research output. Employment verification varies by person; refer
              to each profile's evidence and status.
            </p>
            <p>
              Five-year citations count citations received during{" "}
              {d.metadata.window.join("–")}. Five-year Q1 publications count
              qualifying articles published during that period.
            </p>
            <p>
              h-index is an individual metric. Its values are never summed to
              produce an institutional h-index.
            </p>
            <p>Q1 policy: {d.metadata.q1Methodology}</p>
            <p>
              We do not infer a Q1 percentage without a valid journal-article
              denominator. Bibliometric sources and snapshot dates remain
              attached to each profile.
            </p>
          </Card>
          <Card title="Known limitations">
            <ul className="limitations">
              {d.metadata.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p>
              Research fields have different citation patterns. Citation counts
              do not represent a complete assessment of academic performance or
              teaching quality.
            </p>
          </Card>
        </div>
      </div>
      <Card title="Source files & updates">
        <p>
          The production application reads replaceable static CSV files in{" "}
          <code>public/data</code>. Academic fields, numeric missing values and
          identifiers are validated at load time. Faculty and department
          equivalence is controlled by a manual mapping file; unmatched units
          stay Unmapped.
        </p>
        <div className="source-links inline">
          {[
            ...(d.metadata.evidenceFiles || []),
            "academics.csv",
            "universities.csv",
            "faculties.csv",
            "departments.csv",
            "metadata.json",
            ...(d.metadata.mode === "real"
              ? [
                  "field-mapping.json",
                  "coverage.csv",
                  "faculty_department_inventory.csv",
                  "research_metrics_snapshots.csv",
                  "data_dictionary.csv",
                  "COLLECTION_NOTES.txt",
                ]
              : []),
          ].map((f) => (
            <a
              className="text-link"
              key={f}
              href={import.meta.env.BASE_URL + "data/" + f}
              download
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
