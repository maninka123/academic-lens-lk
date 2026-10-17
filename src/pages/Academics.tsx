import { useState } from "react";
import { UnitIcon } from "../components/unit-icons";
import { qualificationLines } from "../data/qualification-lines";
import type { Academic, Level } from "../types";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { Pin, ExternalLink, ArrowLeft, Download, FileText, Link2, Check, TriangleAlert } from "lucide-react";
import { useData } from "../data/context";
import { useAtlas } from "../store";
import { filterAcademics, groupRows } from "../analytics/engine";
import { Header, Card, fmt, Empty, CountryName } from "../components/common";
import campusImages from "../data/campus-images.json";
import { Filters } from "../components/Filters";
import { AcademicTable } from "../components/AcademicTable";
import { SideBySide } from "../components/SideBySide";
import { Button } from "../components/ui/button";
import { AcademicPortrait } from "../components/AcademicPortrait";
import { ProfileStanding } from "../components/ProfileStanding";
import { PositionStandards } from "../components/PositionStandards";
import { StandingScorePanel } from "../components/StandingScore";
import { ResearchProfiles } from "../components/ResearchProfiles";
import {
  CoveragePanel,
  EvidenceBadge,
  MetricSummaryTable,
  type EvidenceLevel,
} from "../components/Quality";
import { MIN_SAMPLE } from "../analytics/quality";
import { download } from "../components/common";
import { standingScore } from "../analytics/standing-score";
import { personCsv } from "../reports/person-csv";
export function Academics() {
  const { academics, universities } = useData();
  const [query, setQuery] = useState("");
  const [university, setUniversity] = useState("");
  const [position, setPosition] = useState("");
  const [columnFilters, setColumnFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = selected
    .map((id) => academics.find((a) => a.id === id))
    .filter((a): a is Academic => Boolean(a));
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id],
    );
  const positions = [...new Set(academics.map((a) => a.rank))].filter(Boolean);
  const rows = academics
    .filter((a) => !university || a.universityId === university)
    .filter((a) => !position || a.rank === position)
    .filter((a) =>
      [a.name, a.sourceName, a.university, a.faculty, a.department, a.interests]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  const withPhd = rows.filter((a) => a.qualification === "PhD").length;
  const withMetrics = rows.filter((a) => a.citations !== null).length;
  const pct = (n: number) => (rows.length ? Math.round((100 * n) / rows.length) + "%" : "—");
  return (
    <>
      <Header
        eyebrow="People behind the data"
        title="Academic Explorer"
        description="Search profiles, inspect the evidence, and add academics to your comparisons."
      />
      <section className="directory-facts" aria-label="Directory summary">
        <div><strong>{fmt(rows.length)}</strong><span>profiles shown</span></div>
        <div><strong>{pct(withPhd)}</strong><span>with a documented PhD</span></div>
        <div><strong>{pct(withMetrics)}</strong><span>with citation counts</span></div>
        <div><strong>{new Set(rows.map((a) => a.universityId)).size}</strong><span>universities</span></div>
      </section>
      {chosen.length > 0 && (
        <SideBySide
          people={chosen}
          onRemove={(id) => setSelected((s) => s.filter((x) => x !== id))}
          onClear={() => setSelected([])}
        />
      )}
      <Card
        title="Academic directory"
        subtitle="Most cited first. Tick up to 3 people to see them side by side, or click a name for the full profile."
      >
        <div className="directory-controls">
          <label className="directory-search">
            <span>Search</span>
            <input
              type="search"
              aria-label="Search people by name"
              placeholder="Name, university, department or research interest"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span>University</span>
            <select value={university} onChange={(e) => setUniversity(e.target.value)}>
              <option value="">All universities</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Position</span>
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">All positions</option>
              {positions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={columnFilters}
              onChange={(e) => setColumnFilters(e.target.checked)}
            />
            Column filters
          </label>
        </div>
        <AcademicTable
          key={String(columnFilters)}
          rows={rows}
          columnFilters={columnFilters}
          sortMetric="citations"
          selectedIds={selected}
          onToggleSelect={toggle}
        />
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
type InfoItem = [string, string | number | null, EvidenceLevel?, string?, string?];
function Info({ items }: { items: InfoItem[] }) {
  return (
    <dl className="info-list">
      {items.map(([k, v, level, title, country]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>
            {country ? (
              <>
                <CountryName country={country} />
                {v ? <span className="muted"> | {v}</span> : null}
              </>
            ) : k === "Published qualifications" && typeof v === "string" && qualificationLines(v).length ? (
              <ul className="qual-lines" title={v}>
                {qualificationLines(v).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              evidenceLabel(v)
            )}
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
  const { pin, configure, clear, setFilters } = useAtlas();
  const nav = useNavigate();
  const [reportBusy, setReportBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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
      `${e?.source || a.metricsSource || "Source not recorded"}${e?.date ? " | " + e.date : ""}${ev.identity === "verified" ? " | identity linked from an official page" : " | identity not independently verified"}`,
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
        <div className="person-main">
          <div className="eyebrow">{a.type + " | " + a.rank}</div>
          <h1>{a.name}</h1>
          <p>{a.university}</p>
          <Button
            className="person-compare"
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
                });
                nav("/compare");
              }}
          >
            <Pin size={18} />
            Compare this academic
          </Button>
        </div>
        <StandingScorePanel person={a} />
      </div>
      {a.caution && (
        <div className="profile-caution" role="note">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <strong>Read these figures with care</strong>
            <p>{a.caution}</p>
          </div>
        </div>
      )}
      <section className="key-facts" aria-label="Key facts">
        <div className="key-fact wide">
          <span>Position</span>
          <strong>{a.position || "Not recorded"}</strong>
          <small>{a.faculty || a.university}</small>
        </div>
        <div className="key-fact">
          <span>PhD</span>
          {(() => {
            const done = a.doctorateStatus === "completed_documented";
            const ongoing = a.doctorateStatus === "in_progress";
            const missing = !done && !ongoing;
            return (
              <>
                <strong className={missing ? "none" : undefined}>
                  {done ? (a.phdYear ?? "Completed") : ongoing ? "In progress" : "—"}
                </strong>
                {done && (a.phdCountry || a.phdUniversity) ? (
                  <small className="key-fact-detail">
                    {a.phdCountry && <CountryName country={a.phdCountry} />}
                    {a.phdUniversity && <span>{a.phdUniversity}</span>}
                  </small>
                ) : missing ? (
                  <small>
                    {a.qualification !== "Unknown"
                      ? "Highest: " + a.qualification
                      : "Not documented"}
                  </small>
                ) : null}
              </>
            );
          })()}
        </div>
        {(
          [
            ["Citations", a.citations],
            ["h-index", a.hIndex],
            ["Publications", a.publications],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className={"key-fact" + (v === null ? " unavailable" : "")}>
            <span>{label}</span>
            <strong>{v === null ? "—" : fmt(v)}</strong>
            <small>
              {v === null
                ? "Not recorded"
                : a.metricsSource || "Source not recorded"}
            </small>
          </div>
        ))}
      </section>
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
                ["Broad discipline", a.field],
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
                  ...(a.phdYear !== null && a.phdYear !== undefined
                    ? [["PhD completion year", a.phdYear, "recorded"] as InfoItem]
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
                      ? "inferred from university name"
                      : a.phdCountry ? "" : null,
                    a.phdCountry
                      ? ev.doctorate === "review"
                        ? "review"
                        : "recorded"
                      : "missing",
                    a.phdCountryInferred
                      ? "Inferred from the awarding institution's name; not stated in the source"
                      : "Country of the awarding institution, not necessarily where the person studied",
                    a.phdCountry || undefined,
                  ],
                ]}
              />
            </Card>
            <Card title="Teaching & research">
              <Info
                items={[
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
                ]}
              />
            </Card>
          </div>
        </div>
        <div>
          <div className="card profile-actions">
            <h2>Work with this profile</h2>
            <Button
              variant="outline"
              onClick={async () => {
                const link = location.origin + location.pathname + "#/academics/" + a.id;
                try {
                  await navigator.clipboard.writeText(link);
                } catch {
                  window.prompt("Copy this link", link);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2200);
              }}
            >
              {copied ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
              {copied ? "Link copied" : "Copy profile link"}
            </Button>
            <Button
              variant="outline"
              disabled={reportBusy}
              onClick={async () => {
                setReportBusy(true);
                try {
                  const { buildPersonReport, reportFileName } = await import("../reports/person-pdf");
                  const doc = await buildPersonReport(a, d.academics, d.metadata);
                  doc.save(reportFileName(a));
                } finally {
                  setReportBusy(false);
                }
              }}
            >
              <FileText size={18} aria-hidden="true" />
              {reportBusy ? "Preparing report…" : "Download report (PDF)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const score = standingScore(a, d.academics);
                const stamp = new Date().toISOString().slice(0, 10);
                download(
                  "academic-record-" + a.id + ".csv",
                  personCsv(a, score, stamp),
                );
              }}
            >
              <Download size={18} aria-hidden="true" />
              Download data (CSV)
            </Button>
            <h3>Compare within a group</h3>
            <p>
              Open the Studio showing only the people in the same group as this
              academic.
            </p>
            {(
              [
                ...(a.departmentId ? [["department", "Same department", "department"]] : []),
                ...(a.facultyId ? [["faculty", "Same faculty", "department"]] : []),
                ["university", "Same university", "faculty"],
                ["rank", "Same position", "university"],
                ...(a.field !== "Unmapped" ? [["field", "Same broad discipline", "university"]] : []),
              ] as const
            ).map(([peer, label, level]) => (
              <Button
                className="peer-button"
                variant="outline"
                key={peer}
                onClick={() => {
                  pin(a.id);
                  clear();
                  setFilters({
                    universities: peer === "rank" || peer === "field" ? [] : [a.universityId],
                    faculties: peer === "faculty" || peer === "department" ? [a.facultyId] : [],
                    departments: peer === "department" ? [a.departmentId] : [],
                    ranks: peer === "rank" ? [a.rank] : [],
                    fields: peer === "field" ? [a.field] : [],
                  });
                  configure({
                    groups: [],
                    level: level as Level,
                    chart: "bar",
                    aggregation: "median",
                    metric: "citations",
                    log: false,
                  });
                  nav("/compare");
                }}
              >
                {label}
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
              : "/universities"
        }
      >
        <ArrowLeft size={17} />
        {faculty ? "Parent institution" : "All universities"}
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
            " | " +
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
            Photo | {campus.credit} ↗
          </a>
        )}
      </div>
      <CoveragePanel
        rows={rows}
        rosterNote={
          (d.coverage.find((c) => c.university_id === u.id)?.roster_status ||
            "Directory coverage not assessed.") +
          ` | ${new Set(rows.map((a) => a.facultyId).filter(Boolean)).size} faculties and ${new Set(rows.map((a) => a.departmentId).filter(Boolean)).size} departments represented in the collected profiles.`
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
      {rows.length > 0 && (
        <Card
          title="Standards by position"
          subtitle="How the typical metric changes with seniority in this unit."
        >
          <PositionStandards rows={rows} minN={d.metadata.minimumSample || MIN_SAMPLE} scope={{ universities: [u.id], faculties: faculty ? [faculty] : [], departments: department ? [department] : [] }} />
        </Card>
      )}
      {faculty && rows.some((a) => a.field && a.field !== "Unmapped") && (
        <div className="compare-banner">
          <span>
            <strong>See how this faculty compares</strong>
            <small>Match equivalent fields across institutions in the Comparison Studio.</small>
          </span>
          <Button variant="outline" onClick={() => openCompare(true)}>
            Compare equivalent fields
          </Button>
        </div>
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
                <UnitIcon
                  kind={faculty ? "department" : "faculty"}
                  name={(faculty ? g.rows[0]?.department : g.rows[0]?.faculty) || ""}
                />
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
