// Fill "Citations received 2021–2025" from Google Scholar's year-by-year citation
// graph, using counts supplied by a person (no scraping, no rate-limit bypass).
//
//   node scripts/scholar-yearly.mjs worklist   -> Data files/scholar_yearly_worklist.csv
//   node scripts/scholar-yearly.mjs apply      <- Data files/scholar_yearly_citations.csv
//
// Only five complete calendar years 2021–2025 are summed. Scholar's
// "Since 2021" column is NOT used: it also contains 2026 citations.
import fs from "node:fs";
import Papa from "papaparse";
import { csvRead } from "./shared.mjs";

export const YEARS = [2021, 2022, 2023, 2024, 2025];
const SOURCE = process.env.ATLAS_DATA_DIR || "Data files";

export function scholarId(url = "") {
  try {
    return new URL(url.trim()).searchParams.get("user") || "";
  } catch {
    return "";
  }
}
const isCount = (v) => /^\d+$/.test(String(v ?? "").trim());

/** Rows with a usable Scholar profile and no 2021–2025 citation count yet. */
export function buildWorklist(rows) {
  return rows
    .filter(
      (r) =>
        scholarId(r.google_scholar_url) &&
        String(r.citations_2021_2025 ?? "").trim() === "" &&
        !/rejected|requires_review/.test(r.research_lookup_status || ""),
    )
    .map((r) => ({
      academic_id: r.academic_id,
      full_name: r.full_name,
      university: r.university,
      scholar_id: scholarId(r.google_scholar_url),
      scholar_url: r.google_scholar_url,
      total_citations_known: r.total_citations || "",
      ...Object.fromEntries(YEARS.map((y) => ["y" + y, ""])),
      retrieved_at: "",
    }));
}

/** Validate one filled worklist line against its authoritative record. */
export function validateEntry(entry, row) {
  if (!row) return { ok: false, why: "unknown academic_id" };
  const id = scholarId(row.google_scholar_url);
  if (!id) return { ok: false, why: "record has no Google Scholar profile" };
  if (entry.scholar_id && entry.scholar_id !== id)
    return { ok: false, why: `scholar_id ${entry.scholar_id} does not match the record (${id})` };
  const counts = YEARS.map((y) => entry["y" + y]);
  if (counts.every((c) => String(c ?? "").trim() === ""))
    return { ok: false, why: "no yearly counts supplied", skip: true };
  if (!counts.every(isCount))
    return { ok: false, why: "all five years 2021–2025 are needed as whole numbers (use 0 only when Scholar shows 0)" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.retrieved_at || "").trim()))
    return { ok: false, why: "retrieved_at must be YYYY-MM-DD" };
  const sum = counts.reduce((s, c) => s + Number(c), 0);
  const total = Number(row.total_citations);
  if (Number.isFinite(total) && row.total_citations !== "" && sum > total)
    return { ok: false, why: `2021–2025 sum (${sum}) exceeds the recorded total (${total})` };
  return { ok: true, sum, id };
}

const walk = (p) =>
  fs.readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(p + "/" + e.name)
      : e.name === "academics.csv"
        ? [p + "/" + e.name]
        : [],
  );
const leaves = () => walk(SOURCE + "/universities");

function writeCsv(path, rows, header, bom) {
  const text = Papa.unparse({ fields: header, data: rows.map((r) => header.map((h) => r[h] ?? "")) });
  fs.writeFileSync(path, (bom ? "﻿" : "") + text + "\r\n");
}
function appendRows(path, records) {
  const raw = fs.readFileSync(path, "utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const body = Papa.unparse(records, { newline: nl, header: false });
  fs.writeFileSync(path, raw.replace(/\s*$/, nl) + body + nl);
}

function worklist() {
  const rows = leaves().flatMap((p) => csvRead(p));
  const items = buildWorklist(rows);
  const out = SOURCE + "/scholar_yearly_worklist.csv";
  fs.writeFileSync(out, "﻿" + Papa.unparse(items) + "\r\n");
  console.log(`${items.length} people have a Google Scholar profile but no 2021–2025 citations.`);
  console.log("Written: " + out);
  console.log("Fill y2021…y2025 and retrieved_at, save as " + SOURCE + "/scholar_yearly_citations.csv, then run: node scripts/scholar-yearly.mjs apply");
}

function apply() {
  const file = SOURCE + "/scholar_yearly_citations.csv";
  if (!fs.existsSync(file)) throw Error("Missing " + file);
  const entries = csvRead(file);
  const byLeaf = new Map(leaves().map((p) => [p, csvRead(p)]));
  const index = new Map();
  for (const [p, rows] of byLeaf) for (const r of rows) index.set(r.academic_id, { p, r });
  const done = [], rejected = [], conflicts = [];
  for (const e of entries) {
    const hit = index.get(e.academic_id);
    const v = validateEntry(e, hit?.r);
    if (!v.ok) {
      if (!v.skip) rejected.push(`${e.academic_id} ${e.full_name || ""}: ${v.why}`);
      continue;
    }
    const existing = String(hit.r.citations_2021_2025 ?? "").trim();
    if (existing !== "" && Number(existing) !== v.sum) {
      conflicts.push(`${e.academic_id}: recorded ${existing} vs Scholar graph ${v.sum} (left unchanged)`);
      continue;
    }
    if (existing !== "") continue;
    hit.r.citations_2021_2025 = String(v.sum);
    if (!hit.r.google_scholar_url) continue;
    done.push({ ...e, sum: v.sum, id: v.id });
  }
  for (const [p, rows] of byLeaf) {
    const touched = done.some((d) => index.get(d.academic_id).p === p);
    if (!touched) continue;
    const header = Object.keys(rows[0]);
    const bom = fs.readFileSync(p, "utf8").charCodeAt(0) === 0xfeff;
    writeCsv(p, rows, header, bom);
  }
  if (done.length) {
    const url = (d) => "https://scholar.google.com/citations?user=" + d.id;
    appendRows(SOURCE + "/research_metric_observations.csv", done.map((d) => ({
      academic_id: d.academic_id, platform: "Google Scholar", metric: "citations_2021_2025",
      value: d.sum, source_url: url(d), retrieved_at: d.retrieved_at,
      verification_basis: "scholar_yearly_citation_graph_supplied",
      notes: "Sum of calendar years 2021–2025 from the Scholar citation graph; not the rolling 'Since 2021' column.",
    })));
    appendRows(SOURCE + "/change_log.csv", done.map((d) => ({
      change_id: `SCHOLAR-YEARLY-${d.academic_id}-${d.retrieved_at}`,
      timestamp: d.retrieved_at + "T00:00:00+11:00",
      university_id: "", unit_id: "", academic_id: d.academic_id, action: "update",
      field: "citations_2021_2025", old_value: "", new_value: d.sum,
      reason: "Scholar year-by-year citation graph (2021–2025)", source_url: url(d),
    })));
  }
  console.log(`Applied ${done.length} · conflicts ${conflicts.length} · rejected ${rejected.length}`);
  for (const c of conflicts) console.log("  conflict: " + c);
  for (const r of rejected) console.log("  rejected: " + r);
  if (done.length) console.log("Now run: npm run data:import");
}

if (process.argv[1]?.endsWith("scholar-yearly.mjs")) {
  const cmd = process.argv[2];
  if (cmd === "worklist") worklist();
  else if (cmd === "apply") apply();
  else console.log("Usage: node scripts/scholar-yearly.mjs worklist | apply");
}
