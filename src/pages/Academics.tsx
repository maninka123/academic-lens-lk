import { useState } from "react";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { Pin, ExternalLink, ArrowLeft } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import {
  filterAcademics,
  completeness,
  aggregate,
  groupRows,
} from "../analytics/engine";
import { Header, Card, Stat, fmt, Empty } from "../components/common";
import { AcademicTable } from "../components/AcademicTable";
import { Button } from "../components/ui/button";
import { AcademicPortrait } from "../components/AcademicPortrait";
import { ProfileStanding } from "../components/ProfileStanding";
import { ResearchProfiles } from "../components/ResearchProfiles";
import { exportCsv } from "../components/common";
export function Academics() {
  const { academics } = useData();
  const { filters } = useAtlas();
  const [query, setQuery] = useState("");
  const [useFilters, setUseFilters] = useState(false);
  const rows = (
    useFilters ? filterAcademics(academics, filters) : academics
  ).filter((a) =>
    [a.name, a.sourceName, a.university, a.faculty, a.department, a.interests]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <Header
        eyebrow="People behind the data"
        title="Academic Explorer"
        description="Search profiles, inspect the evidence, and add academics to your comparisons."
      />
      <Card
        title="Academic directory"
        subtitle="Click a name for the full profile. Pin people to keep them in the Comparison Studio."
      >
        <div className="people-search">
          <label>
            Search people by name
            <input
              type="search"
              placeholder="Name, university, department, or research interest"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={useFilters}
              onChange={(e) => setUseFilters(e.target.checked)}
            />
            Apply global filters
          </label>
        </div>
        <p className="chart-note">
          * marks a documented completed PhD or higher research doctorate.
          Display titles follow the project convention; official titles remain
          in each profile. Every collected person has an individual profile.
          Showing {rows.length.toLocaleString()} of{" "}
          {academics.length.toLocaleString()} records.
        </p>
        <AcademicTable rows={rows} columnFilters />
      </Card>
    </>
  );
}
const evidenceLabel = (value: string | number | null) => {
  if (value === null || value === "" || value === "Unknown")
    return "Not yet documented";
  const labels: Record<string, string> = {
    listed_completed: "Completed — listed in qualifications",
    completed: "Completed",
    in_progress: "In progress",
    not_published_or_not_extracted: "Not yet documented",
    not_explicitly_verified: "Appointment type not confirmed",
    permanent_officially_listed: "Permanent — officially listed",
    emeritus_officially_listed: "Emeritus — officially listed",
    former_institution_appointment_current_other_institution:
      "Former appointment — now at another institution",
    overlapping_institution_appointments_review_required:
      "Multiple affiliations — review needed",
    Unmapped: "Not yet classified",
  };
  return typeof value === "string" ? labels[value] || value : value;
};
function Info({ items }: { items: [string, string | number | null][] }) {
  return (
    <dl className="info-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{evidenceLabel(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Profile() {
  const { id } = useParams();
  const d = useData(),
    a = d.academics.find((a) => a.id === id);
  const { pin, configure, clear } = useAtlas();
  const nav = useNavigate();
  const canonical = id && d.metadata.identityAliases?.[id];
  if (canonical) return <Navigate to={"/academics/" + canonical} replace />;
  if (!a) return <Empty title="Profile not found" />;
  return (
    <>
      <Link className="text-link" to="/academics">
        <ArrowLeft size={17} />
        Academic directory
      </Link>
      <nav className="profile-hierarchy" aria-label="Academic hierarchy">
        <Link to={"/university/" + a.universityId}>{a.university}</Link>
        <span>›</span>
        {a.facultyId ? (
          <Link
            to={"/university/" + a.universityId + "/faculty/" + a.facultyId}
          >
            {a.faculty}
          </Link>
        ) : (
          <span>Faculty unavailable</span>
        )}
        {a.departmentId && a.facultyId && (
          <>
            <span>›</span>
            <Link
              to={
                "/university/" +
                a.universityId +
                "/faculty/" +
                a.facultyId +
                "/department/" +
                a.departmentId
              }
            >
              {a.department}
            </Link>
          </>
        )}
      </nav>
      <div className="person-hero">
        <AcademicPortrait academic={a} />
        <Header
          eyebrow={a.type + " · " + a.rank}
          title={a.name}
          description={a.university}
          action={
            <Button
              onClick={() => {
                pin(a.id);
                clear();
                configure({
                  metric: "citations",
                  aggregation: "median",
                  chart: "bar",
                  level: "university",
                  groups: [],
                  log: false,
                  peer: a.departmentId
                    ? "department"
                    : a.facultyId
                      ? "faculty"
                      : "university",
                });
                nav("/compare");
              }}
            >
              <Pin size={18} />
              Compare this academic
            </Button>
          }
        />
      </div>
      <p className="portrait-note">
        Symbolic academic illustration. * denotes a documented completed PhD or
        higher research doctorate.
      </p>
      <ResearchProfiles academic={a} />
      {a.qualificationReview && (
        <p className="notice" role="status">
          {a.qualificationReview}
        </p>
      )}
      <ProfileStanding academic={a} rows={d.academics} />
      <div className="profile-layout">
        <div>
          <Card title="Academic information">
            <Info
              items={[
                ["Name as published by the source", a.sourceName || a.name],
                ["University", a.university],
                ["Faculty / school", a.faculty],
                ["Department", a.department],
                ["Published position", a.position],
                ["Normalised position", a.rank],
                ["Research interests", a.interests],
                ["Standardised field", a.field],
                ["Employment status", a.employmentStatus],
              ]}
            />
          </Card>
          <div className="two-columns">
            <Card title="Education">
              <Info
                items={[
                  ["Published qualifications", a.qualifications],
                  ["Highest documented qualification", a.qualification],
                  ["PhD institution", a.phdUniversity],
                  ["PhD country", a.phdCountry],
                  ["PhD completion year", a.phdYear],
                  ["PhD evidence status", a.phdStatus],
                ]}
              />
            </Card>
            <Card title="Teaching & research">
              <Info
                items={[
                  [
                    "Recorded academic experience",
                    a.experience === null ? null : a.experience + " years",
                  ],
                  ["Publications", a.publications],
                  ["Citations", a.citations],
                  [
                    `Citations received ${d.metadata.window.join("–")}`,
                    a.recentCitations,
                  ],
                  ["h-index", a.hIndex],
                  ["Q1 journal publications", a.q1],
                  [
                    `Q1 publications published ${d.metadata.window.join("–")}`,
                    a.recentQ1,
                  ],
                ]}
              />
            </Card>
          </div>
          <Card title="Sources & snapshot">
            {a.metricEvidence?.length ? (
              <div className="table-scroll">
                <table>
                  <caption>
                    Evidence for this person's recorded research metrics
                  </caption>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Source</th>
                      <th>Retrieved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.metricEvidence.map((e) => (
                      <tr key={e.metric}>
                        <td>
                          {(
                            {
                              publications: "Publications",
                              citations: "Citations",
                              recentCitations: "Five-year citations",
                              hIndex: "h-index",
                              q1: "Q1 publications",
                              recentQ1: "Five-year Q1 publications",
                            } as Record<string, string>
                          )[e.metric] || e.metric}
                        </td>
                        <td>{fmt(e.value)}</td>
                        <td>
                          {/^https?:\/\//.test(e.url) ? (
                            <a
                              className="text-link"
                              href={e.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {e.source}
                            </a>
                          ) : (
                            e.source
                          )}
                          <p className="caption">{e.note}</p>
                        </td>
                        <td>{e.date || "Not recorded"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <Info
              items={[
                ["Collection date", a.collectionDate],
                ["Metric snapshot date", a.snapshotDate],
                ["Metric source", a.metricsSource],
                ["Verification status", a.status],
                ["Notes", a.notes],
              ]}
            />
            <div className="inline source-links">
              {[
                [a.sourceUrl, "Official academic source"],
                [a.scholarUrl, "Google Scholar link"],
                [a.metricsUrl, "Bibliometric source"],
              ]
                .filter(([url]) => /^https?:\/\//.test(url))
                .map(([url, label]) => (
                  <a
                    key={label}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                    href={url}
                  >
                    {label}
                    <ExternalLink size={16} />
                  </a>
                ))}
            </div>
          </Card>
        </div>
        <div>
          <div className="card">
            <h2>Work with this profile</h2>
            <Button variant="outline" onClick={() => exportCsv([a])}>
              Export this person’s record
            </Button>
            <h3>Explore peer groups</h3>
            <p>
              Open this person's data in the Studio and select a peer
              definition.
            </p>
            {[
              ...(a.departmentId ? ["department"] : []),
              ...(a.facultyId ? ["faculty"] : []),
              "university",
              "rank",
              ...(a.field !== "Unmapped" ? ["field"] : []),
            ].map((peer) => (
              <Button
                className="peer-button"
                variant="outline"
                key={peer}
                onClick={() => {
                  pin(a.id);
                  clear();
                  configure({
                    peer,
                    groups: [],
                    level: "university",
                    chart: "bar",
                    aggregation: "median",
                    metric: "citations",
                    log: false,
                  });
                  nav("/compare");
                }}
              >
                Same {peer}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
export function Institution() {
  const { id, faculty, department } = useParams();
  const d = useData();
  const u = d.universities.find((u) => u.id === id);
  const { filters, configure, setFilters } = useAtlas();
  const nav = useNavigate();
  if (!u) return <Empty title="Institution not found" />;
  const rows = filterAcademics(d.academics, filters).filter(
    (a) =>
      a.universityId === id &&
      (!faculty || a.facultyId === faculty) &&
      (!department || a.departmentId === department),
  );
  const raw = d.academics.filter((a) => a.universityId === id);
  const units = groupRows(rows, faculty ? "department" : "faculty");
  const directRows = rows.filter((a) =>
    faculty ? !a.departmentId : !a.facultyId,
  );
  if (
    (faculty && !raw.some((a) => a.facultyId === faculty)) ||
    (department &&
      !raw.some(
        (a) => a.facultyId === faculty && a.departmentId === department,
      ))
  )
    return (
      <Empty title="Unit not found">
        This unit is not recorded in the selected institution.
      </Empty>
    );
  const label = department
    ? raw.find((a) => a.departmentId === department)?.department
    : faculty
      ? raw.find((a) => a.facultyId === faculty)?.faculty
      : u.name;
  const openCompare = (equivalent = false) => {
    const fields = [
      ...new Set(rows.map((a) => a.field).filter((f) => f && f !== "Unmapped")),
    ];
    setFilters(
      equivalent
        ? {
            universities: [],
            faculties: [],
            departments: [],
            fields,
          }
        : {
            universities: [u.id],
            faculties: faculty ? [faculty] : [],
            departments: department ? [department] : [],
          },
    );
    configure({
      level: equivalent
        ? "university"
        : department
          ? "department"
          : faculty && units.length
            ? "department"
            : "faculty",
      groups: [],
      metric: "citations",
      aggregation: "median",
      chart: "bar",
      log: false,
    });
    nav("/compare");
  };
  return (
    <>
      <Link
        className="text-link"
        to={
          department
            ? "/university/" + id + "/faculty/" + faculty
            : faculty
              ? "/university/" + id
              : "/"
        }
      >
        <ArrowLeft size={17} />
        {faculty ? "Parent institution" : "Overview"}
      </Link>
      <Header
        eyebrow={
          u.type +
          " · " +
          (department
            ? "Department"
            : faculty
              ? "Faculty / school"
              : "Institution explorer")
        }
        title={label || "Unit unavailable"}
        description={
          faculty
            ? u.name
            : "Collected academic profiles and organisational structure."
        }
        action={
          <Button onClick={() => openCompare()}>
            Open in Comparison Studio
          </Button>
        }
      />
      <div className="stats-grid four">
        <Stat label="Available profiles" value={rows.length} />
        <Stat
          label="Recorded faculties"
          value={new Set(rows.map((a) => a.facultyId).filter(Boolean)).size}
        />
        <Stat
          label="Recorded departments"
          value={new Set(rows.map((a) => a.departmentId).filter(Boolean)).size}
        />
        <Stat
          label="Citation completeness"
          value={
            rows.length
              ? fmt(completeness(rows, "citations"), 1) + "%"
              : "Not available"
          }
          detail={`${rows.filter((a) => a.citations !== null).length} valid records`}
        />
      </div>
      <div className="stats-grid four">
        {(["citations", "publications", "experience", "hIndex"] as const).map(
          (m) => (
            <Stat
              key={m}
              label={
                "Median " +
                {
                  citations: "citations",
                  publications: "publications",
                  experience: "experience",
                  hIndex: "h-index",
                }[m]
              }
              value={fmt(aggregate(rows, m, "median").value, 1)}
              detail={`${aggregate(rows, m, "median").n} valid profiles`}
            />
          ),
        )}
      </div>
      {faculty && rows.some((a) => a.field && a.field !== "Unmapped") && (
        <Button variant="outline" onClick={() => openCompare(true)}>
          Compare equivalent fields across institutions
        </Button>
      )}
      {!rows.length && (
        <Empty title="No collected profiles">
          This institution or unit has no records under the current filters.
          This does not imply it has no academic staff.
        </Empty>
      )}
      {!department && units.length > 0 && (
        <Card
          title={faculty ? "Departments" : "Faculties / schools"}
          subtitle="Only recorded organisational units are shown. Profiles without a named department stay at faculty level."
        >
          <div className="institution-grid">
            {units.map((g) => (
              <Link
                className="institution-card"
                key={g.id}
                to={
                  faculty
                    ? "/university/" +
                      id +
                      "/faculty/" +
                      faculty +
                      "/department/" +
                      g.id
                    : "/university/" + id + "/faculty/" + g.id
                }
              >
                <div>
                  <strong>
                    {faculty
                      ? g.rows[0]?.department || "Department unavailable"
                      : g.rows[0]?.faculty || "Faculty unavailable"}
                  </strong>
                  <small>
                    {g.rows.length} collected{" "}
                    {g.rows.length === 1 ? "profile" : "profiles"}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
      {!department && directRows.length > 0 && (
        <Card
          title={
            faculty ? "Faculty-level academics" : "Institution-level academics"
          }
          subtitle={
            faculty
              ? "No department is recorded for these people. They belong to this faculty only."
              : "No faculty is recorded for these people."
          }
        >
          <AcademicTable rows={directRows} />
        </Card>
      )}
      <Card
        title={
          department
            ? "Department academics"
            : faculty
              ? "All academics in this faculty"
              : "All academics in this institution"
        }
      >
        <AcademicTable rows={rows} />
      </Card>
    </>
  );
}
