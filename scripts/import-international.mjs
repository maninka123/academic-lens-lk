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
      qualification: phd ? "PhD" : "Unknown",
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
      benchmarkMatches: {
        attempted: rows.length,
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
