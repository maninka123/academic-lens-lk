// Imports the international baseline hierarchy (Data files/international) into
// public/data/international/ for the Global benchmarks page. The Sri Lankan
// dataset produced by import-data.mjs is not modified.
import fs from "node:fs";
import { csvRead, csvWrite, slug } from "./shared.mjs";
import { normaliseRank } from "./evidence.mjs";

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

// Equivalent position labels for non-English titles. Source text stays in `position`.
// Order matters: 副教授 and 助理教授 contain 教授.
const RANKS = [
  [
    /副教授|副研究员|professeure? agrégée?|associate professor/i,
    "Associate Professor",
  ],
  [
    /助理教授|助理研究员|professeure? adjointe?|jun\.-prof|junior prof|assistant professor|professeur assistant|professeure assistante/i,
    "Assistant Professor",
  ],
  [
    /教授|院士|研究员|^professeure?\b|professeure? des universit|univ\.-prof|^prof\.|directeu?r(ice)? de recherche/i,
    "Professor",
  ],
  [
    /讲师|ma[iî]tre(sse)? de conf|chargée? de recherche|chargée? d'enseignement|enseignant/i,
    "Lecturer",
  ],
];
const rankOf = (p) => {
  const r = normaliseRank(p || "");
  if (!["Other", "Unknown"].includes(r)) return r;
  return RANKS.find(([re]) => re.test(p || ""))?.[1] || r;
};
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
    const phd =
      r.phd_status !== "in_progress" &&
      (Boolean(r.phd_university) ||
        /ph\.?\s?d|doctorat|doctorate|博士/i.test(r.qualifications || ""));
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
      position: r.academic_position,
      rank: rankOf(r.academic_position),
      qualification: phd ? "PhD" : "Unknown",
      phdUniversity: r.phd_university,
      phdCountry: r.phd_country,
      phdYear: n(r.phd_completion_year),
      phdStatus: r.phd_status,
      publications: n(r.total_publications),
      citations: n(r.total_citations),
      recentCitations: n(r.citations_2021_2025),
      hIndex: n(r.h_index),
      metricsSource: r.research_metrics_source,
      metricsUrl: r.metrics_source_url,
      lookupStatus: r.research_lookup_status,
      sourceUrl: r.staff_profile_url,
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
    },
    null,
    2,
  ),
);
console.log(
  `Imported ${rows.length} international baseline records from ${universities.length} universities.`,
);
