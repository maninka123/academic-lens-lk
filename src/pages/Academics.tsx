import { useState } from "react";
import type { Academic } from "../types";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { Pin, ExternalLink, ArrowLeft } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { Header, Card, fmt, Empty } from "../components/common";
import campusImages from "../data/campus-images.json";
import { Filters } from "../components/Filters";
import { AcademicTable } from "../components/AcademicTable";
import { Button } from "../components/ui/button";
import { AcademicPortrait } from "../components/AcademicPortrait";
import { ProfileStanding } from "../components/ProfileStanding";
import { ResearchProfiles } from "../components/ResearchProfiles";
import {
  CoveragePanel,
  EvidenceBadge,
  MetricSummaryTable,
  type EvidenceLevel,
} from "../components/Quality";
import { MIN_SAMPLE } from "../analytics/quality";
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
            Advanced filters
          </label>
        </div>
        {useFilters && <Filters />}
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
type InfoItem = [string, string | number | null, EvidenceLevel?, string?];
function Info({ items }: { items: InfoItem[] }) {
  return (
    <dl className="info-list">
      {items.map(([k, v, level, title]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>
            {evidenceLabel(v)}
            {level === "review" && (
              <EvidenceBadge level={level} title={title} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
/** Evidence level of the main facts on a profile. */
export function profileEvidence(a: Academic) {
  const identity: EvidenceLevel = [a.scholarStatus, a.researchgateStatus].some(
    (s) =>
      [
        "verified_official_link",
        "matched_user_supplied_platform_evidence",
      ].includes(s || ""),
  )
    ? "verified"
    : [a.scholarStatus, a.researchgateStatus].some((s) =>
          /review|rejected/.test(s || ""),
        )
      ? "review"
      : a.scholarUrl || a.researchgateUrl
        ? "recorded"
        : "missing";
  const employment: EvidenceLevel = /review/.test(a.employmentStatus + a.status)
    ? "review"
    : ["permanent_officially_listed", "emeritus_officially_listed"].includes(
          a.employmentStatus,
        )
      ? "verified"
      : "recorded";
  const doctorate: EvidenceLevel =
    a.doctorateStatus === "completed_documented"
      ? "verified"
      : a.doctorateStatus === "contradictory"
        ? "review"
        : a.doctorateStatus === "in_progress"
          ? "recorded"
          : "missing";
  return { identity, employment, doctorate };
}
const doctorateText: Record<string, string> = {
  completed_documented: "Completed — documented in the source",
  in_progress: "In progress — not counted as a completed PhD",
  contradictory: "Contradictory evidence — not counted until reviewed",
  unknown: "Not documented",
};
export function Profile() {
  const { id } = useParams();
  const d = useData(),
    a = d.academics.find((a) => a.id === id);
  const { pin, configure, clear } = useAtlas();
  const nav = useNavigate();
  const canonical = id && d.metadata.identityAliases?.[id];
  if (canonical) return <Navigate to={"/academics/" + canonical} replace />;
  if (!a) return <Empty title="Profile not found" />;
  const ev = profileEvidence(a);
  const metricLevel = (
    m: "publications" | "citations" | "recentCitations" | "hIndex",
  ): [EvidenceLevel?, string?] => {
    if (a[m] === null) return ["missing"];
    const e = a.metricEvidence?.find((x) => x.metric === m);
    return [
      ev.identity === "verified"
        ? "verified"
        : ev.identity === "review"
          ? "review"
          : "recorded",
      `${e?.source || a.metricsSource || "Source not recorded"}${e?.date ? " · " + e.date : ""}${ev.identity === "verified" ? " · identity linked from an official page" : " · identity not independently verified"}`,
    ];
  };
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
                [
                  "Name as published by the source",
                  a.sourceName || a.name,
                  "recorded",
                  "Original published name, unchanged",
                ],
                [
                  "Faculty / school",
                  a.faculty,
                  a.faculty ? "recorded" : "missing",
                ],
                [
                  "Department",
                  a.department,
                  a.department ? "recorded" : "missing",
                ],
                [
                  "Published position",
                  a.position,
                  a.position ? "recorded" : "missing",
                ],
                [
                  "Research interests",
                  a.interests,
                  a.interests ? "recorded" : "missing",
                ],
                ["Standardised field", a.field],
                [
                  "Employment status",
                  a.employmentStatus,
                  ev.employment,
                  "Verified only when an official source states a permanent or emeritus appointment",
                ],
              ]}
            />
          </Card>
          <div className="two-columns">
            <Card title="Education">
              <Info
                items={[
                  [
                    "Published qualifications",
                    a.qualifications,
                    a.qualifications ? "recorded" : "missing",
                  ],
                  ...(["in_progress", "contradictory"].includes(
                    a.doctorateStatus || "",
                  )
                    ? [
                        [
                          "Doctorate status",
                          doctorateText[a.doctorateStatus!],
                        ] as InfoItem,
                      ]
                    : []),
                  [
                    "PhD awarding institution",
                    a.phdUniversity,
                    a.phdUniversity
                      ? ev.doctorate === "review"
                        ? "review"
                        : "recorded"
                      : "missing",
                  ],
                  [
                    "PhD awarding country",
                    a.phdCountry && a.phdCountryInferred
                      ? `${a.phdCountry} (inferred from university name)`
                      : a.phdCountry,
                    a.phdCountry
                      ? ev.doctorate === "review"
                        ? "review"
                        : "recorded"
                      : "missing",
                    a.phdCountryInferred
                      ? "Inferred from the awarding institution's name; not stated in the source"
                      : "Country of the awarding institution, not necessarily where the person studied",
                  ],
                  [
                    "PhD completion year",
                    a.phdYear,
                    a.phdYear ? "recorded" : "missing",
                  ],
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
                  [
                    "Publications",
                    a.publications,
                    ...metricLevel("publications"),
                  ],
                  ["Citations", a.citations, ...metricLevel("citations")],
                  [
                    `Citations received ${d.metadata.window.join("–")}`,
                    a.recentCitations,
                    ...metricLevel("recentCitations"),
                  ],
                  ["h-index", a.hIndex, ...metricLevel("hIndex")],
                  ["Q1 journal publications", a.q1],
                  [
                    `Q1 publications published ${d.metadata.window.join("–")}`,
                    a.recentQ1,
                  ],
                ]}
              />
            </Card>
          </div>
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
  const { configure, setFilters } = useAtlas();
  const nav = useNavigate();
  if (!u) return <Empty title="Institution not found" />;
  // The explorer shows the collected institution/unit, independently of saved comparison filters.
  const rows = d.academics.filter(
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
  const campus = campusImages[u.id as keyof typeof campusImages];
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
      <div className="institution-hero">
        {campus && (
          <img
            className="institution-hero-image"
            src={import.meta.env.BASE_URL + campus.image}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
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
          description={faculty ? u.name : "People, faculties & research"}
          action={
            <Button onClick={() => openCompare()}>Compare institution</Button>
          }
        />
        {campus && (
          <a
            className="campus-credit"
            href={campus.source}
            target="_blank"
            rel="noreferrer"
          >
            Photo · {campus.credit} ↗
          </a>
        )}
      </div>
      <CoveragePanel
        rows={rows}
        rosterNote={
          (d.coverage.find((c) => c.university_id === u.id)?.roster_status ||
            "Directory coverage not assessed.") +
          ` · ${new Set(rows.map((a) => a.facultyId).filter(Boolean)).size} faculties and ${new Set(rows.map((a) => a.departmentId).filter(Boolean)).size} departments represented in the collected profiles.`
        }
      />
      <Card
        title="Research metrics"
        subtitle="Collected profiles in this unit. Each median uses a single bibliometric provider; groups below the minimum sample are not reported."
      >
        <MetricSummaryTable
          rows={rows}
          minN={d.metadata.minimumSample || MIN_SAMPLE}
        />
      </Card>
      {faculty && rows.some((a) => a.field && a.field !== "Unmapped") && (
        <Button variant="outline" onClick={() => openCompare(true)}>
          Compare equivalent fields across institutions
        </Button>
      )}
      {!rows.length && (
        <Empty title="No collected profiles">
          This institution or unit has no collected records in this dataset.
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
