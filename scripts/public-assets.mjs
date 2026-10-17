// Public asset policy for the static website.
//
// The deployed site (and everything under public/data) is publicly readable even
// though the repository is private. Only the files and columns listed here may
// be published. Internal research evidence (identity reviews, investigation
// logs, collection notes, correction logs) stays in `Data files/`.
import fs from "node:fs";
import path from "node:path";

/** Files allowed under public/data (relative paths, "/" separators). */
export const PUBLIC_FILES = [
  "academics.csv",
  "universities.csv",
  "faculties.csv",
  "departments.csv",
  "metadata.json",
  "field-mapping.json",
  "world.geo.json",
  "coverage_summary.csv",
  "dataset_summary.json",
  "data_dictionary.csv",
  "datasets.json",
  "international/academics.csv",
  "international/publications.csv",
  "international/universities.csv",
  "international/departments.csv",
  "international/metadata.json",
  "international/sri_lanka_openalex.csv",
];

/** Columns published in public/data/academics.csv (everything the UI reads). */
export const PUBLIC_ACADEMIC_COLUMNS = [
  "id",
  "name",
  "country",
  "universityId",
  "facultyId",
  "departmentId",
  "university",
  "faculty",
  "department",
  "type",
  "position",
  "rank",
  "qualifications",
  "qualification",
  "doctorateStatus",
  "phdUniversity",
  "phdCountry",
  "phdCountryInferred",
  "phdYear",
  "phdStatus",
  "experience",
  "interests",
  "publications",
  "citations",
  "recentCitations",
  "hIndex",
  "sourceUrl",
  "scholarUrl",
  "researchgateUrl",
  "scholarStatus",
  "researchgateStatus",
  "openAlexStatus",
  "openAlexUrl",
  "openAlexMatchLevel",
  "researchIdentities",
  "researchObservations",
  "qualificationReview",
  "metricEvidence",
  "metricsUrl",
  "metricsSource",
  "collectionDate",
  "snapshotDate",
  "status",
  "employmentStatus",
  "field",
  "notes",
];

/** Headers that only occur in internal review/evidence files. */
const INTERNAL_HEADERS = [
  "unfinished_tasks",
  "identity_verification_status",
  "resolution_basis",
  "verification_basis",
  "previous_value",
  "name_match_basis",
  "canonical_academic_id",
  "official_pages_read",
  "discovered_from",
  "research_link_status",
  "employment_evidence",
];

const SECRET_PATTERNS = [
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk-[A-Za-z0-9]{20,}/, "API secret key"],
  [/xox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [
    /[?&](access_token|api_key|apikey|token|sig|signature|password|gmla)=[^&\s"]+/i,
    "credential-like URL parameter",
  ],
];

const walk = (dir) =>
  !fs.existsSync(dir)
    ? []
    : fs.statSync(dir).isFile()
      ? [dir]
      : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name);
          return e.isDirectory() ? walk(p) : [p];
        });

/**
 * Check a published data directory (public/data or dist/data) and optionally a
 * build directory for credentials. Returns a list of problems (empty = pass).
 */
export function checkPublicData(dataDir, { scanOnly = [] } = {}) {
  const problems = [];
  for (const file of walk(dataDir)) {
    const rel = path.relative(dataDir, file).split(path.sep).join("/");
    if (rel === ".DS_Store" || rel.endsWith("/.DS_Store")) continue;
    if (!PUBLIC_FILES.includes(rel))
      problems.push(
        `${rel}: not on the public allowlist (scripts/public-assets.mjs)`,
      );
    if (/\.(csv|json|txt|md)$/i.test(rel)) {
      const text = fs.readFileSync(file, "utf8");
      if (rel.endsWith(".csv")) {
        const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0].split(",");
        const internal = header.filter((h) =>
          INTERNAL_HEADERS.includes(h.trim()),
        );
        if (internal.length)
          problems.push(
            `${rel}: internal evidence columns published (${internal.join(", ")})`,
          );
        if (rel === "academics.csv") {
          const extra = header.filter(
            (h) => !PUBLIC_ACADEMIC_COLUMNS.includes(h.trim()),
          );
          if (extra.length)
            problems.push(
              `${rel}: columns outside the public schema (${extra.join(", ")})`,
            );
        }
      }
      for (const [re, label] of SECRET_PATTERNS)
        if (re.test(text)) problems.push(`${rel}: possible ${label}`);
    }
  }
  for (const file of scanOnly.flatMap(walk)) {
    if (!/\.(js|css|html|json|csv|txt|map)$/i.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const [re, label] of SECRET_PATTERNS)
      if (re.test(text)) problems.push(`${file}: possible ${label}`);
  }
  return problems;
}
