// Imports the international baseline hierarchy (Data files/international) into
// public/data/international/ for the Global benchmarks page. The Sri Lankan
// dataset produced by import-data.mjs is not modified.
import fs from "node:fs";
import { csvRead, csvWrite, slug } from "./shared.mjs";
import { sanitizeUrl, doctorateStatus } from "./evidence.mjs";
import { rankFor, careerStage } from "./countries.mjs";
import { checkPublicData } from "./public-assets.mjs";

const source = (process.argv[2] || "Data files") + "/international";
const out = "public/data/international";
if (!fs.existsSync(source + "/universities.csv")) {
  console.log("No international baseline data found; skipping.");
  process.exit(0);
}
const walk = (p) =>
  fs
    .readdirSync(p, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? e.name.startsWith("_")
          ? []
          : walk(p + "/" + e.name)
        : e.name === "academics.csv"
          ? [p + "/" + e.name]
          : [],
    );
const universities = csvRead(source + "/universities.csv");
const departments = csvRead(source + "/departments.csv");
const byName = new Map(universities.map((u) => [u.name, u]));
const fieldOf = new Map(
  departments.map((d) => [d.university_id + "|" + d.department, d.field]),
);

// Position titles (including French, German and Chinese) map through the shared
// country rules; the published source title stays in `position`.
const rankOf = (p) => rankFor(p, "International");
// Proxy units stand in for a missing discipline (e.g. engineering where a
// university has no physics department). Research-lab rosters mix university
// faculty and research-agency staff. Both are flagged, never silently equated.
const unitNote = (d) =>
  /substitute|nearest/i.test(d.department + " " + d.source_note)
    ? "proxy"
    : /\blab|laboratoire|LaBRI|LOMA|ICube|ETIS|OPTIMAG|STICC/i.test(
          d.department + " " + d.source_note,
        )
      ? "research-lab"
      : "department";
const unitOf = new Map(
  departments.map((d) => [d.university_id + "|" + d.department, unitNote(d)]),
);
const researchDetails = fs.existsSync(source + "/research_profiles.csv") ? csvRead(source + "/research_profiles.csv") : [];
const detailsById = new Map(researchDetails.map((r) => [r.academic_id, r]));
const n = (v) => {
  if (v == null || String(v).trim() === "") return null;
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0) throw Error("Invalid numeric value: " + v);
  return x;
};
const rows = walk(source)
  .flatMap(csvRead)
  .map((r) => {
    const u = byName.get(r.university);
    if (!u) throw Error("Unknown international university: " + r.university);
    const detail = detailsById.get(r.academic_id);
    const doctorate = doctorateStatus(r);
    const phd = doctorate === "completed_documented";
    return {
      id: r.academic_id,
      name: r.full_name,
      universityId: u.id,
      university: u.name,
      universityShort: u.short,
      country: u.country,
      tier: u.tier,
      qsRank: u.qs_rank_2027,
      type: u.type,
      facultyId: u.id + "--" + slug(r.faculty),
      departmentId: u.id + "--" + slug(r.department),
      faculty: r.faculty,
      department: r.department,
      field: fieldOf.get(u.id + "|" + r.department) || "Unmapped",
      unitType: unitOf.get(u.id + "|" + r.department) || "department",
      position: r.academic_position,
      rank: rankOf(r.academic_position),
      careerStage: careerStage(rankOf(r.academic_position)),
      qualification: phd ? (/\b(?:ph\.?\s?d|d\.?\s?phil)\b/i.test(r.qualifications) ? "PhD" : "Doctorate") : "Unknown",
      qualifications: r.qualifications,
      interests: r.research_interests,
      scholarUrl: sanitizeUrl(r.google_scholar_url),
      researchgateUrl: sanitizeUrl(r.researchgate_url),
      researchProfileUrl: sanitizeUrl(detail?.research_profile_url || ""),
      orcidUrl: sanitizeUrl(detail?.orcid_url || ""),
      listedPublicationCount: n(detail?.listed_publication_count),
      publicationScope: detail?.publication_scope || "not_collected",
      profileCheckedAt: detail?.profile_checked_at || "",
      doctorateStatus: doctorate,
      phdUniversity: r.phd_university,
      phdCountry: r.phd_country,
      phdYear: n(r.phd_completion_year),
      phdStatus: r.phd_status,
      publications: n(r.total_publications),
      citations: n(r.total_citations),
      recentCitations: n(r.citations_2021_2025),
      hIndex: n(r.h_index),
      metricsSource: r.research_metrics_source,
      metricsUrl: sanitizeUrl(r.metrics_source_url),
      lookupStatus: r.research_lookup_status,
      sourceUrl: sanitizeUrl(r.staff_profile_url),
      collectionDate: r.collected_at,
    };
  });
if (new Set(rows.map((r) => r.id)).size !== rows.length)
  throw Error("Duplicate international academic IDs");
csvWrite(out + "/academics.csv", rows);
csvWrite(
  out + "/universities.csv",
  universities.map((u) => ({
    id: u.id,
    name: u.name,
    short: u.short,
    country: u.country,
    type: u.type,
    qsRank: u.qs_rank_2027,
    tier: u.tier,
    records: rows.filter((r) => r.universityId === u.id).length,
    substitution: u.substitution_note,
  })),
);
csvWrite(
  out + "/departments.csv",
  departments.map((d) => ({
    universityId: d.university_id,
    country: d.country,
    tier: d.tier,
    faculty: d.faculty,
    department: d.department,
    field: d.field,
    unitType: unitNote(d),
    rosterEligible: d.roster_eligible,
    sampled: d.sampled,
    source: sanitizeUrl((d.source_note.match(/https?:\/\/\S+/) || [""])[0]),
  })),
);
const bibliography = fs.existsSync(source + "/publications.csv") ? csvRead(source + "/publications.csv") : [];
csvWrite(out + "/publications.csv", bibliography.map((r) => ({
  academicId: r.academic_id,
  title: r.title,
  year: r.year,
  authors: r.authors,
  venue: r.venue,
  url: sanitizeUrl(r.url),
  sourceUrl: sanitizeUrl(r.source_url),
  scope: r.scope,
  citation: r.citation,
  collectionDate: r.collected_at,
})));
const slOpenAlex = fs.existsSync(source + "/sri_lanka_openalex_metrics.csv")
  ? csvRead(source + "/sri_lanka_openalex_metrics.csv")
  : [];
csvWrite(
  out + "/sri_lanka_openalex.csv",
  slOpenAlex.map((r) => ({
    id: r.academic_id,
    publications: n(r.total_publications),
    citations: n(r.total_citations),
    recentCitations: n(r.citations_2021_2025),
    hIndex: n(r.h_index),
    openalexId: r.openalex_id,
    status: r.status,
  })),
);
const qs = csvRead(source + "/qs_rankings_2027.csv").filter(
  (r) => r.country === "Sri Lanka",
);
fs.writeFileSync(
  out + "/metadata.json",
  JSON.stringify(
    {
      qsEdition: "QS World University Rankings 2027 (published 18 June 2026)",
      collectionDate: rows
        .map((r) => r.collectionDate)
        .sort()
        .at(-1),
      sriLankaQs: Object.fromEntries(qs.map((r) => [r.id, r.qs_rank_2027])),
      metricSource:
        "OpenAlex (name + institution matched; ambiguous names left blank)",
      measurementDate: rows
        .map((r) => r.collectionDate)
        .sort()
        .at(-1),
      fields: [...new Set(departments.map((d) => d.field))],
      fieldCoverage: Object.fromEntries([...new Set(departments.map((d) => d.field))].map((field) => [field, {
        records: rows.filter((r) => r.field === field).length,
        universities: new Set(rows.filter((r) => r.field === field).map((r) => r.universityId)).size,
        measured: rows.filter((r) => r.field === field && r.hIndex != null).length,
      }])),
      samplingNote: "Up to 25 academics per unit; newer disciplines cover selected universities only. Unverified metrics remain blank.",
      benchmarkMatches: {
        attempted: rows.filter((r) => r.lookupStatus !== "not_yet_verified").length,
        matched: rows.filter((r) => /(^|_)matched(_|$)/.test(r.lookupStatus)).length,
      },
      sriLankaOpenAlex: {
        attempted: slOpenAlex.length,
        matched: slOpenAlex.filter((r) => r.openalex_id).length,
        note: "Attempted lookups are not matches. Only matched researchers carry OpenAlex values.",
      },
    },
    null,
    2,
  ),
);
console.log(
  `Imported ${rows.length} international baseline records from ${universities.length} universities.`,
);
const problems = checkPublicData("public/data");
if (problems.length) {
  console.error("Public asset check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
