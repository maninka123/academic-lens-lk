import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { exportCsv } from "../components/common";
export function Academics() {
  const { academics } = useData();
  const { filters } = useAtlas();
  const [query, setQuery] = useState("");
  const [useFilters, setUseFilters] = useState(false);
  const rows = (
    useFilters ? filterAcademics(academics, filters) : academics
  ).filter((a) =>
    [a.name, a.university, a.faculty, a.department, a.interests]
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
          Every collected person has an individual profile. Showing{" "}
          {rows.length.toLocaleString()} of {academics.length.toLocaleString()}{" "}
          records.
        </p>
        <AcademicTable rows={rows} />
      </Card>
    </>
  );
}
function Info({ items }: { items: [string, string | number | null][] }) {
  return (
    <dl className="info-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === null || v === "" ? "Not available" : v}</dd>
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
        <span>›</span>
        {a.departmentId && a.facultyId ? (
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
        ) : (
          <span>Department unavailable</span>
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
                configure({ metric: "citations", peer: "department" });
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
        Symbolic illustration based on the recorded qualification and position.
        It does not represent appearance, age, or gender; gender is not recorded
        in this dataset.
      </p>
      <ProfileStanding academic={a} rows={d.academics} />
      <div className="profile-layout">
        <div>
          <Card title="Academic information">
            <Info
              items={[
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
            {["department", "faculty", "university", "rank", "field"].map(
              (peer) => (
                <Button
                  className="peer-button"
                  variant="outline"
                  key={peer}
                  onClick={() => {
                    pin(a.id);
                    clear();
                    configure({ peer, groups: [] });
                    nav("/compare");
                  }}
                >
                  Same {peer}
                </Button>
              ),
            )}
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
  const label = department
    ? raw.find((a) => a.departmentId === department)?.department
    : faculty
      ? raw.find((a) => a.facultyId === faculty)?.faculty
      : u.name;
  const openCompare = (equivalent = false) => {
    const field = rows.find((a) => a.field !== "Unmapped")?.field;
    setFilters(
      equivalent
        ? {
            universities: [],
            faculties: [],
            departments: [],
            fields: field ? [field] : [],
          }
        : {
            universities: [u.id],
            faculties: faculty ? [faculty] : [],
            departments: department ? [department] : [],
          },
    );
    configure({
      level: equivalent
        ? "field"
        : department
          ? "department"
          : faculty
            ? "department"
            : "faculty",
      groups: [],
      metric: "citations",
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
          value={fmt(completeness(rows, "citations"), 1) + "%"}
          detail={`${rows.filter((a) => a.citations !== null).length} valid records`}
        />
      </div>
      <div className="stats-grid four">
        {(["citations", "publications", "experience", "hIndex"] as const).map(
          (m) => (
            <Stat
              key={m}
              label={"Median " + m}
              value={fmt(aggregate(rows, m, "median").value, 1)}
              detail={`${aggregate(rows, m, "median").n} valid profiles`}
            />
          ),
        )}
      </div>
      {faculty && (
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
      {!department && (
        <Card
          title={faculty ? "Departments" : "Faculties / schools"}
          subtitle="Unavailable organisational units are shown without assuming membership."
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
                  <small>{g.rows.length} collected profiles</small>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
      <Card title="Academic profiles">
        <AcademicTable rows={rows} />
      </Card>
    </>
  );
}
