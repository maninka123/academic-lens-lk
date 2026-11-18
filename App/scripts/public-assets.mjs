// Public asset policy for the static website.
//
// The deployed site (and everything under public/data) is publicly readable even
// though the repository is private. Only the files and columns listed here may
// be published. Internal research evidence (identity reviews, investigation
// logs, collection notes, correction logs) stays in `Data/`.
import fs from "node:fs";
import path from "node:path";
import { publicFieldProblems, contactProblems, leaveRemarkProblems, INTERNAL_TOKENS } from "./public-notes.mjs";

/** Files allowed under public/data (relative paths, "/" separators). */
export const PUBLIC_FILES = [
  "academics.csv",
  "universities.csv",
  "qs_rankings_2027.csv",
  "faculties.csv",
  "organisational_units.csv",
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
  "phdInstitution",
  "phdQsRank",
  "phdQsStatus",
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
  "caution",
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

export const SECRET_PATTERNS = [
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
      if (rel === "academics.csv") problems.push(...sensitiveFieldProblems(text, rel));
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

/** Free-text columns of the published records are scanned for personal links, contact details and internal wording. */
const FREE_TEXT_COLUMNS = ["notes", "caution", "qualificationReview", "experience"];
/** Columns that must never carry contact details (scraped text can hide them anywhere). */
const CONTACT_COLUMNS = ["interests", "qualifications", "qualification", "name", "position", "faculty", "department", "phdUniversity"];
/** Structured and status columns: internal workflow vocabulary must not appear, only neutral public wording. */
const STRUCTURED_COLUMNS = ["researchIdentities", "researchObservations", "metricEvidence", "scholarStatus", "researchgateStatus", "openAlexStatus", "openAlexMatchLevel", "status", "employmentStatus", "snapshotDate", "metricsSource"];
export function sensitiveFieldProblems(csvText, rel = "academics.csv") {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const header = rows.shift() || [];
  const col = (names) => names.map((c) => [c, header.indexOf(c)]).filter(([, i]) => i >= 0);
  const found = new Map();
  const add = (c, what) => {
    const key = `${c}: ${what}`;
    found.set(key, (found.get(key) || 0) + 1);
  };
  for (const r of rows) {
    for (const [c, i] of col(FREE_TEXT_COLUMNS)) for (const what of publicFieldProblems(r[i])) add(c, what);
    for (const [c, i] of col(CONTACT_COLUMNS)) for (const what of contactProblems(r[i])) add(c, what);
    for (const [c, i] of col(["name", "position"])) for (const what of leaveRemarkProblems(r[i])) add(c, what);
    for (const [c, i] of col(STRUCTURED_COLUMNS)) if (INTERNAL_TOKENS.test(r[i] || "")) add(c, "internal workflow wording");
  }
  return [...found].map(([k, n]) => `${rel}: ${k} (${n} record${n === 1 ? "" : "s"})`);
}

/** The tracked source CSVs are as public as public/data: the same contact and leave rules apply to them. */
export function sourceFieldProblems(csvText, rel) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const header = rows.shift() || [];
  const idx = (c) => header.indexOf(c);
  const found = new Map();
  for (const r of rows) {
    for (const c of ["qualifications", "research_interests", "full_name", "academic_position"]) {
      if (idx(c) < 0) continue;
      for (const what of contactProblems(r[idx(c)])) found.set(`${c}: ${what}`, (found.get(`${c}: ${what}`) || 0) + 1);
    }
    for (const c of ["full_name", "academic_position"])
      if (idx(c) >= 0) for (const what of leaveRemarkProblems(r[idx(c)])) found.set(`${c}: ${what}`, (found.get(`${c}: ${what}`) || 0) + 1);
  }
  return [...found].map(([k, n]) => `${rel}: ${k} (${n} record${n === 1 ? "" : "s"})`);
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
