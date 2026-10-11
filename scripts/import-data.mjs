import fs from "node:fs";
import { createHash } from "node:crypto";
import { csvRead, universities, slug, hierarchy, csvWrite } from "./shared.mjs";
import {
  resolveAlias,
  linkStatus,
  metricEvidence,
  normaliseRank,
} from "./evidence.mjs";
const source = process.argv[2] || "Data files";
const walk = (p) =>
  fs
    .readdirSync(p, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(p + "/" + e.name)
        : e.name === "academics.csv"
          ? [p + "/" + e.name]
          : [],
    );
const inputs = fs.existsSync(source + "/universities")
  ? walk(source + "/universities")
  : [source + "/academics_all.csv"];
const sourceRows = inputs.flatMap(csvRead);
const optionalCsv = (name) =>
  fs.existsSync(source + "/" + name) ? csvRead(source + "/" + name) : [];
const snapshots = optionalCsv("research_metrics_snapshots.csv");
const observations = optionalCsv("research_metric_observations.csv");
const identities = optionalCsv("research_identity_evidence.csv");
const aliasRows = optionalCsv("identity_aliases.csv");
const aliases = Object.fromEntries(
  aliasRows.map((r) => [r.alias_academic_id, r.canonical_academic_id]),
);
for (const id of Object.keys(aliases)) {
  aliases[id] = resolveAlias(id, aliases);
  if (
    !sourceRows.some((r) => r.academic_id === aliases[id]) ||
    sourceRows.some((r) => r.academic_id === id)
  )
    throw Error("Invalid academic alias: " + id);
}
const n = (v) => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw Error("Invalid numeric value: " + v);
  return n;
};
const rows = sourceRows.map((r) => {
  const u = universities.find(
    (u) => u.name === r.university.replace(/ \(SLIIT\)$/, ""),
  );
  if (!u) throw Error("Unknown university: " + r.university);
  const facultyId = r.faculty ? u.id + "--" + slug(r.faculty) : "",
    departmentId = r.department
      ? (facultyId || u.id) + "--" + slug(r.department)
      : "";
  const q = r.qualifications || "";
  const phd =
    r.phd_status !== "in_progress" &&
    (Boolean(r.phd_university) || /\bph\.?d\b|doctor of philosophy/i.test(q));
  const evidence = metricEvidence(r, snapshots, observations, aliases);
  const scholarStatus = linkStatus(
    r.academic_id,
    r.google_scholar_url,
    identities,
    aliases,
  );
  const researchgateStatus = linkStatus(
    r.academic_id,
    r.researchgate_url,
    identities,
    aliases,
  );
  const qualificationReview =
    r.phd_status === "in_progress" && /university of reading/i.test(q)
      ? "Qualification evidence names the University of Reading, but the recorded PhD status is in progress. Completion status needs data review."
      : "";
  return {
    id: r.academic_id,
    name: r.full_name,
    universityId: u.id,
    facultyId,
    departmentId,
    university: u.name,
    faculty: r.faculty,
    department: r.department,
    type: u.type,
    position: r.academic_position,
    rank: normaliseRank(r.academic_position),
    qualifications: q,
    qualification: phd
      ? "PhD"
      : /master|m\.?sc|m\.?phil|mba|m\.?eng|m\.?a\b/i.test(q)
        ? "Masters / MPhil"
        : /bachelor|b\.?sc|b\.?eng|b\.?a\b/i.test(q)
          ? "Bachelors"
          : q
            ? "Other documented"
            : "Unknown",
    phdUniversity: r.phd_university,
    phdCountry: r.phd_country,
    phdYear: n(r.phd_completion_year),
    phdStatus: r.phd_status,
    experience: n(r.teaching_academic_experience_years),
    interests: r.research_interests,
    publications: n(r.total_publications),
    citations: n(r.total_citations),
    recentCitations: n(r.citations_2021_2025),
    hIndex: n(r.h_index),
    q1: n(r.total_q1_journal_publications),
    recentQ1: n(r.q1_publications_2021_2025),
    sourceUrl: r.staff_profile_url,
    scholarUrl: r.google_scholar_url,
    researchgateUrl: r.researchgate_url || r.research_gate_url || "",
    scholarStatus,
    researchgateStatus,
    qualificationReview,
    metricEvidence: JSON.stringify(evidence),
    metricsUrl: r.metrics_source_url,
    metricsSource: r.research_metrics_source,
    collectionDate: r.collected_at,
    snapshotDate: [...new Set(evidence.map((e) => e.date).filter(Boolean))]
      .sort()
      .join("; "),
    status: r.record_status,
    employmentStatus: r.employment_status,
    field: "Unmapped",
    notes: r.notes,
  };
});
if (rows.some((r) => !r.id || !r.name))
  throw Error("An academic ID and full name are required");
if (new Set(rows.map((r) => r.id)).size !== rows.length)
  throw Error("Duplicate academic IDs");
hierarchy(
  rows,
  "public/data",
  universities.filter((u) => u.id !== "saegis"),
);
if (fs.existsSync(source + "/field-mapping.json"))
  fs.copyFileSync(
    source + "/field-mapping.json",
    "public/data/field-mapping.json",
  );
else if (!fs.existsSync("public/data/field-mapping.json"))
  fs.writeFileSync(
    "public/data/field-mapping.json",
    JSON.stringify(
      {
        description:
          "Manual mappings only. Unlisted units remain Unmapped. Review mappings before interpreting equivalence.",
        faculties: {},
        departments: {},
      },
      null,
      2,
    ),
  );
const settings = fs.existsSync(source + "/metadata.json")
  ? JSON.parse(fs.readFileSync(source + "/metadata.json", "utf8"))
  : {};
const missing = ["hIndex", "recentCitations", "q1", "recentQ1"].filter((k) =>
  rows.every((r) => r[k] === null),
);
const names = {
  hIndex: "h-index",
  recentCitations: "exact five-year citations",
  q1: "Q1 publications",
  recentQ1: "five-year Q1 publications",
};
const q1Policy = fs.existsSync(source + "/q1_methodology.md")
  ? fs.readFileSync(source + "/q1_methodology.md", "utf8")
  : settings.q1Methodology ||
    "No documented Q1 policy has been supplied. Missing counts remain unknown; no counts are inferred from Scholar totals.";
const metadata = {
  ...settings,
  version:
    "partial-" +
    createHash("sha256")
      .update(
        JSON.stringify(rows) +
          fs.readFileSync("public/data/field-mapping.json", "utf8") +
          JSON.stringify(settings) +
          q1Policy,
      )
      .digest("hex")
      .slice(0, 10),
  mode: "real",
  identityAliases: aliases,
  evidenceFiles: [
    "research_metric_observations.csv",
    "research_identity_evidence.csv",
    "identity_aliases.csv",
    "academic_affiliations.csv",
    "field_evidence.csv",
    "missing_field_resolutions.csv",
    "profile_verification.csv",
    "collection_report.md",
    "APPLICATION_HANDOFF.md",
  ].filter((f) => fs.existsSync(source + "/" + f)),
  collectionDate:
    settings.collectionDate ||
    rows
      .map((r) => r.collectionDate)
      .filter(Boolean)
      .sort()
      .at(-1) ||
    "Not available",
  window: settings.window || [2021, 2025],
  description:
    settings.description ||
    "Partial collection with documented corrections and source-specific research evidence. Counts are calculated from authoritative academic records; archives, aliases and evidence rows are excluded.",
  scopeNote:
    settings.scopeNote ||
    "The real collection contains 14 institutions in scope and excludes Saegis. An institution without collected profiles is not an institution without academic staff.",
  q1Methodology: q1Policy,
  limitations: settings.limitations || [
    "Not an exhaustive national census. Extracted facts and employment require factual review.",
    "Name variants and cross-institution appointments may be duplicated.",
    "Indexed ResearchGate snapshots may be stale and are not interchangeable with Google Scholar totals.",
    "Qualification and teaching evidence can be incomplete. A title such as Dr is not evidence of a PhD.",
    ...(missing.length
      ? [
          "No collected values for: " +
            missing.map((k) => names[k]).join(", ") +
            ".",
        ]
      : []),
    "Country identifies the awarding institution, not necessarily the physical location of study.",
  ],
  sourceFiles: source,
};
if (
  !Array.isArray(metadata.window) ||
  metadata.window.length !== 2 ||
  metadata.window.some((v) => !Number.isInteger(v))
)
  throw Error("A valid five-year window is required");
fs.writeFileSync(
  "public/data/metadata.json",
  JSON.stringify(metadata, null, 2),
);
for (const f of [
  ...metadata.evidenceFiles,
  "coverage.csv",
  "faculty_department_inventory.csv",
  "research_metrics_snapshots.csv",
  "data_dictionary.csv",
  "access_issues.csv",
  "COLLECTION_NOTES.txt",
])
  fs.copyFileSync(source + "/" + f, "public/data/" + f);
console.log(
  `Imported ${rows.length} records. Missing numeric values preserved.`,
);
