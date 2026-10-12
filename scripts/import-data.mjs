// Imports the authoritative Sri Lankan hierarchy (Data files/universities/…) into
// the published application data (public/data). Only allowlisted files and
// columns are published (scripts/public-assets.mjs); internal evidence stays in
// Data files/. Also regenerates the dataset summary, the validation report
// (reports/) and the README snapshot block so every count describes one import.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { csvRead, universities, slug, hierarchy, csvWrite } from "./shared.mjs";
import {
  resolveAlias,
  linkStatus,
  metricEvidence,
  openAlexFallback,
  doctorateStatus,
  doctorateReview,
  sanitizeUrl,
  sanitizeText,
} from "./evidence.mjs";
import { rankFor, careerStage, COUNTRY_PROFILES } from "./countries.mjs";
import { lowerQualification } from "./qualifications.mjs";
import {
  PUBLIC_FILES,
  PUBLIC_ACADEMIC_COLUMNS,
  checkPublicData,
} from "./public-assets.mjs";

const source = process.argv[2] || "Data files";
const out = "public/data";
const COUNTRY = "Sri Lanka";
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
// Librarian appointments are outside the academic teaching/research scope.
const sourceRows = inputs
  .flatMap(csvRead)
  .filter((r) => !/librarian/i.test(r.academic_position || ""));
const optionalCsv = (name) =>
  fs.existsSync(source + "/" + name) ? csvRead(source + "/" + name) : [];
const snapshots = optionalCsv("research_metrics_snapshots.csv");
const observations = optionalCsv("research_metric_observations.csv");
const openAlex = optionalCsv("international/sri_lanka_openalex_metrics.csv");
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
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0) throw Error("Invalid numeric value: " + v);
  return x;
};
const openAlexById = new Map(openAlex.map((r) => [resolveAlias(r.academic_id, aliases), r]));
const rows = sourceRows.map((original) => {
  const fallback = openAlexFallback(original, openAlexById.get(original.academic_id));
  const r = { ...original, ...fallback.fields };
  const u = universities.find(
    (u) => u.name === r.university.replace(/ \(SLIIT\)$/, ""),
  );
  if (!u) throw Error("Unknown university: " + r.university);
  const facultyId = r.faculty ? u.id + "--" + slug(r.faculty) : "",
    departmentId = r.department
      ? (facultyId || u.id) + "--" + slug(r.department)
      : "";
  const q = r.qualifications || "";
  const doctorate = doctorateStatus(r);
  const evidence = [...metricEvidence(original, snapshots, observations, aliases), ...fallback.evidence].map(
    (e) => ({ ...e, url: sanitizeUrl(e.url), note: sanitizeText(e.note) }),
  );
  const reviews = [
    doctorate === "contradictory" ? doctorateReview.contradictory : "",
    r.phd_university && doctorate === "unknown"
      ? "A doctoral institution is recorded, but no completion evidence is documented; completion is not assumed."
      : "",
  ].filter(Boolean);
  return {
    id: r.academic_id,
    name: r.full_name,
    country: COUNTRY,
    universityId: u.id,
    facultyId,
    departmentId,
    university: u.name,
    faculty: r.faculty,
    department: r.department,
    type: u.type,
    position: r.academic_position,
    rank: rankFor(r.academic_position, COUNTRY),
    qualifications: q,
    qualification:
      doctorate === "completed_documented" ? "PhD" : lowerQualification(q),
    doctorateStatus: doctorate,
    phdUniversity: r.phd_university,
    phdCountry: r.phd_country,
    // Labels countries inferred from the awarding institution's name.
    phdCountryInferred: /^inferred/.test(r.phd_country_basis || "")
      ? "yes"
      : "",
    phdYear:
      doctorate === "completed_documented" ? n(r.phd_completion_year) : null,
    phdStatus: r.phd_status,
    experience: n(r.teaching_academic_experience_years),
    interests: r.research_interests,
    publications: n(r.total_publications),
    citations: n(r.total_citations),
    recentCitations: n(r.citations_2021_2025),
    hIndex: n(r.h_index),
    q1: n(r.total_q1_journal_publications),
    recentQ1: n(r.q1_publications_2021_2025),
    sourceUrl: sanitizeUrl(r.staff_profile_url),
    scholarUrl: sanitizeUrl(r.google_scholar_url),
    researchgateUrl: sanitizeUrl(
      r.researchgate_url || r.research_gate_url || "",
    ),
    scholarStatus: linkStatus(
      r.academic_id,
      r.google_scholar_url,
      identities,
      aliases,
    ),
    researchgateStatus: linkStatus(
      r.academic_id,
      r.researchgate_url || r.research_gate_url || "",
      identities,
      aliases,
    ),
    openAlexStatus: openAlexById.get(r.academic_id)?.status || "not_attempted",
    openAlexUrl: sanitizeUrl(openAlexById.get(r.academic_id)?.openalex_id || ""),
    qualificationReview: reviews.join(" "),
    metricEvidence: JSON.stringify(evidence),
    metricsUrl: sanitizeUrl(r.metrics_source_url || fallback.evidence[0]?.url || ""),
    metricsSource: r.research_metrics_source || (fallback.evidence.length ? "OpenAlex" : ""),
    collectionDate: r.collected_at,
    snapshotDate: [...new Set(evidence.map((e) => e.date).filter(Boolean))]
      .sort()
      .join("; "),
    status: r.record_status,
    employmentStatus: r.employment_status,
    field: "Unmapped",
    notes: sanitizeText(r.notes),
  };
});
if (rows.some((r) => !r.id || !r.name))
  throw Error("An academic ID and full name are required");
if (new Set(rows.map((r) => r.id)).size !== rows.length)
  throw Error("Duplicate academic IDs");

// --- Publish: clear anything not on the allowlist, then write public files.
fs.mkdirSync(out, { recursive: true });
const keepStatic = new Set(["world.geo.json"]);
for (const f of fs.readdirSync(out, { withFileTypes: true }))
  if (f.isFile() && !keepStatic.has(f.name) && !PUBLIC_FILES.includes(f.name))
    fs.rmSync(out + "/" + f.name);
const inScope = universities
  .filter((u) => u.id !== "saegis")
  .map((u) => ({ ...u, country: COUNTRY }));
hierarchy(
  rows.map((r) =>
    Object.fromEntries(PUBLIC_ACADEMIC_COLUMNS.map((c) => [c, r[c] ?? ""])),
  ),
  out,
  inScope,
);
if (fs.existsSync(source + "/field-mapping.json"))
  fs.copyFileSync(source + "/field-mapping.json", out + "/field-mapping.json");
else if (!fs.existsSync(out + "/field-mapping.json"))
  fs.writeFileSync(
    out + "/field-mapping.json",
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
// Field definitions are public documentation.
if (fs.existsSync(source + "/data_dictionary.csv"))
  fs.copyFileSync(
    source + "/data_dictionary.csv",
    out + "/data_dictionary.csv",
  );

// --- Coverage indicators (computed from authoritative records only).
const verifiedIdentity = (r) =>
  [
    "verified_official_link",
    "matched_user_supplied_platform_evidence",
  ].includes(r.scholarStatus) ||
  [
    "verified_official_link",
    "matched_user_supplied_platform_evidence",
  ].includes(r.researchgateStatus);
const verifiedEmployment = (r) =>
  ["permanent_officially_listed", "emeritus_officially_listed"].includes(
    r.employmentStatus,
  );
const anyMetric = (r) =>
  ["publications", "citations", "recentCitations", "hIndex"].some(
    (k) => r[k] !== null,
  );
const needsReview = (r) =>
  /review/i.test(
    r.status +
      " " +
      r.employmentStatus +
      " " +
      r.scholarStatus +
      " " +
      r.researchgateStatus,
  ) || r.doctorateStatus === "contradictory";
const inventory = optionalCsv("faculty_department_inventory.csv");
const coverageRows = optionalCsv("coverage.csv");
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const summarise = (rs) => ({
  academic_records: rs.length,
  verified_identity: rs.filter(verifiedIdentity).length,
  verified_employment: rs.filter(verifiedEmployment).length,
  with_any_metric: rs.filter(anyMetric).length,
  with_qualifications: rs.filter((r) => r.qualifications).length,
  doctorate_documented: rs.filter(
    (r) => r.doctorateStatus === "completed_documented",
  ).length,
  doctorate_in_progress: rs.filter((r) => r.doctorateStatus === "in_progress")
    .length,
  doctorate_contradictory: rs.filter(
    (r) => r.doctorateStatus === "contradictory",
  ).length,
  needs_review: rs.filter(needsReview).length,
});
const coverage = inScope.map((u) => {
  const rs = rows.filter((r) => r.universityId === u.id);
  const inv = inventory.filter((i) => i.university === u.name);
  const status =
    coverageRows.find((c) => c.university === u.name)?.coverage_status ||
    "not_assessed";
  return {
    university_id: u.id,
    university: u.name,
    type: u.type,
    ...summarise(rs),
    faculties_represented: new Set(rs.map((r) => r.facultyId).filter(Boolean))
      .size,
    departments_represented: new Set(
      rs.map((r) => r.departmentId).filter(Boolean),
    ).size,
    units_discovered: inv.length,
    units_visited: inv.filter((i) => /^yes$/i.test(i.visited)).length,
    roster_status:
      status === "incomplete" || !rs.length
        ? "incomplete — collected profiles are not a staff census"
        : status,
  };
});
csvWrite(out + "/coverage_summary.csv", coverage);

// --- Metadata.
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
const totals = summarise(rows);
const collectionDate =
  settings.collectionDate ||
  rows
    .map((r) => r.collectionDate)
    .filter(Boolean)
    .sort()
    .at(-1) ||
  "Not available";
const version =
  "partial-" +
  createHash("sha256")
    .update(
      JSON.stringify(rows) +
        fs.readFileSync(out + "/field-mapping.json", "utf8") +
        JSON.stringify(settings) +
        q1Policy,
    )
    .digest("hex")
    .slice(0, 10);
const metadata = {
  ...Object.fromEntries(
    Object.entries(settings).filter(([k]) => k !== "sourceFiles"),
  ),
  version,
  mode: "real",
  country: COUNTRY,
  identityAliases: aliases,
  collectionDate,
  window: settings.window || [2021, 2025],
  description:
    settings.description ||
    "Partial collection with documented corrections and source-specific research evidence. Counts are calculated from authoritative academic records; archives, aliases and evidence rows are excluded.",
  scopeNote:
    settings.scopeNote ||
    `${inScope.length} institutions are in scope (Saegis excluded); ${coverage.filter((c) => c.academic_records).length} have collected profiles. An institution or unit without collected profiles is not an institution without academic staff, and collected profiles are not the total academic population.`,
  q1Methodology: q1Policy,
  minimumSample: settings.minimumSample || 10,
  correctionContact: settings.correctionContact || "",
  limitations: settings.limitations || [
    "Not an exhaustive national census: collected profiles are a subset of the academic population, and directory coverage is incomplete for every institution.",
    "Name variants and cross-institution appointments may be duplicated; unresolved identity cases are reviewed privately.",
    "Google Scholar, ResearchGate and OpenAlex report different counts. Values from different providers are not interchangeable.",
    "Qualification and teaching evidence can be incomplete. A title such as Dr, a recorded doctoral institution or ambiguous text is not evidence of a completed PhD.",
    ...(missing.length
      ? [
          "No collected values for: " +
            missing.map((k) => names[k]).join(", ") +
            ".",
        ]
      : []),
    "Country identifies the awarding institution, not necessarily the physical location of study.",
  ],
};
if (
  !Array.isArray(metadata.window) ||
  metadata.window.length !== 2 ||
  metadata.window.some((v) => !Number.isInteger(v))
)
  throw Error("A valid five-year window is required");
fs.writeFileSync(out + "/metadata.json", JSON.stringify(metadata, null, 2));

// --- Dataset registry (future multi-country support).
fs.writeFileSync(
  out + "/datasets.json",
  JSON.stringify(
    {
      primary: "LK",
      datasets: [
        {
          id: "LK",
          country: COUNTRY,
          ...COUNTRY_PROFILES[COUNTRY],
          path: "./",
          source: undefined,
        },
        {
          id: "INT",
          country: "International",
          ...COUNTRY_PROFILES.International,
          path: "international/",
          source: undefined,
        },
      ],
    },
    null,
    2,
  ),
);

// --- Snapshot summary shared by the app, README and validation report.
const intlPath = "Data files/international/universities.csv";
const intl = fs.existsSync(source + "/international/universities.csv")
  ? csvRead(source + "/international/universities.csv")
  : fs.existsSync(intlPath)
    ? csvRead(intlPath)
    : [];
const metricAvailability = Object.fromEntries(
  [
    "publications",
    "citations",
    "recentCitations",
    "hIndex",
    "q1",
    "recentQ1",
  ].map((k) => [k, rows.filter((r) => r[k] !== null).length]),
);
const stageCounts = rows.reduce((m, r) => {
  const s = careerStage(r.rank);
  m[s] = (m[s] || 0) + 1;
  return m;
}, {});
const summary = {
  version,
  collectionDate,
  country: COUNTRY,
  institutionsInScope: inScope.length,
  institutionsWithProfiles: coverage.filter((c) => c.academic_records).length,
  facultiesRepresented: new Set(rows.map((r) => r.facultyId).filter(Boolean))
    .size,
  departmentsRepresented: new Set(
    rows.map((r) => r.departmentId).filter(Boolean),
  ).size,
  ...Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [
      k.replace(/_(\w)/g, (_, c) => c.toUpperCase()),
      v,
    ]),
  ),
  metricAvailability,
  careerStages: stageCounts,
  identityAliases: Object.keys(aliases).length,
  internationalBenchmarks: {
    universities: intl.length,
    academics: intl.reduce((s, u) => s + Number(u.academic_records || 0), 0),
    countries: new Set(intl.map((u) => u.country)).size,
  },
};
fs.writeFileSync(
  out + "/dataset_summary.json",
  JSON.stringify(summary, null, 2),
);

// --- Internal validation report (not published).
const reviewFile = (f) => optionalCsv(f).length;
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/dataset-summary.json",
  JSON.stringify(summary, null, 2),
);
const line = (label, v, of = totals.academic_records) =>
  `| ${label} | ${v} | ${of ? pct(v, of) + "%" : "—"} |`;
fs.writeFileSync(
  "reports/validation-report.md",
  [
    `# Dataset validation report`,
    ``,
    `Generated by \`npm run data:import\` for dataset version **${version}** (collection ${collectionDate}). Do not edit by hand.`,
    ``,
    `## Integrity checks (passed)`,
    ``,
    `- ${rows.length} authoritative records, unique non-empty IDs and names`,
    `- ${Object.keys(aliases).length} identity aliases resolve to existing canonical records without cycles`,
    `- Numeric fields are non-negative; blank stays unknown (never zero)`,
    `- Published files and columns match the public allowlist; no credential-like strings`,
    ``,
    `## Coverage`,
    ``,
    `| Indicator | Records | Share of collected |`,
    `|---|---:|---:|`,
    line("Collected academic records", totals.academic_records),
    line(
      "Verified research identity (official link)",
      totals.verified_identity,
    ),
    line("Verified permanent/emeritus employment", totals.verified_employment),
    line("Any research metric available", totals.with_any_metric),
    line("Published qualifications", totals.with_qualifications),
    line("Completed doctorate documented", totals.doctorate_documented),
    line("Doctorate in progress", totals.doctorate_in_progress),
    line("Contradictory doctorate evidence", totals.doctorate_contradictory),
    line("Records requiring manual review", totals.needs_review),
    ``,
    `Open review files (internal): identity ${reviewFile("identity_review.csv")}, employment ${reviewFile("employment_review.csv")}, unit ${reviewFile("unit_review.csv")}, unresolved research ${reviewFile("research_unresolved.csv")}.`,
    ``,
    `## Institutions`,
    ``,
    `| Institution | Records | Verified identity | Verified employment | Any metric | Units discovered | Roster status |`,
    `|---|---:|---:|---:|---:|---:|---|`,
    ...coverage.map(
      (c) =>
        `| ${c.university} | ${c.academic_records} | ${c.verified_identity} | ${c.verified_employment} | ${c.with_any_metric} | ${c.units_discovered} | ${c.roster_status} |`,
    ),
    ``,
    `## Metric availability`,
    ``,
    ...Object.entries(metricAvailability).map(
      ([k, v]) => `- ${k}: ${v} of ${rows.length}`,
    ),
    ``,
  ].join("\n"),
);

// --- Keep the README snapshot in step with this import.
const readme = "README.md";
if (fs.existsSync(readme)) {
  const block = [
    "<!-- dataset-summary:start -->",
    `<!-- Snapshot ${version} -->`,
    `**${summary.academicRecords.toLocaleString("en")} Sri Lankan profiles · ${summary.institutionsWithProfiles} institutions · ${summary.internationalBenchmarks.academics.toLocaleString("en")} international benchmark profiles.** Partial collection, updated ${collectionDate}. [Coverage report](reports/validation-report.md).`,
    "<!-- dataset-summary:end -->",
  ].join("\n");
  const text = fs.readFileSync(readme, "utf8");
  fs.writeFileSync(
    readme,
    /<!-- dataset-summary:start -->[\s\S]*?<!-- dataset-summary:end -->/.test(
      text,
    )
      ? text.replace(
          /<!-- dataset-summary:start -->[\s\S]*?<!-- dataset-summary:end -->/,
          block,
        )
      : text,
  );
}

const problems = checkPublicData(out).filter(
  (p) => !p.startsWith("international/"),
);
if (problems.length)
  throw Error("Public asset check failed:\n- " + problems.join("\n- "));
console.log(
  `Imported ${rows.length} records (${totals.doctorate_documented} documented doctorates, ${totals.doctorate_contradictory} contradictory, ${totals.needs_review} needing review). Missing numeric values preserved.`,
);
