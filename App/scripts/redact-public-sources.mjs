#!/usr/bin/env node
// Makes the tracked source CSVs match the public-data rules, without losing anything.
//
//   node scripts/redact-public-sources.mjs          list what would change
//   node scripts/redact-public-sources.mjs --apply  rewrite the source CSVs
//
// The source CSVs under `Data/universities/` are tracked, so they are as public as `public/data`.
// This script removes from them, and only from them:
//   - email addresses, phone numbers, personal social links and scraped website footers in qualifications and interests
//   - parenthetical remarks about leave in names and positions
//   - links and numbers that came from a profile recorded as belonging to a different person
// Every original value is first appended to the git-ignored `Data/_research_reviews/source_redactions.csv`,
// so the information stays available to the maintainer. The importer applies the same rules to public output,
// so a source file that re-introduces a value still publishes nothing.
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { stripContactDetails, stripLeaveRemark } from "./public-notes.mjs";
import { researchInputs, rejectedProfileKeys } from "./research-data.mjs";
import { profileKey } from "./evidence.mjs";

const SOURCE = process.env.DATA_SOURCE || "../Data";
const apply = process.argv.includes("--apply");
const ARCHIVE = `${SOURCE}/_research_reviews/source_redactions.csv`;

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : e.name === "academics.csv" ? [p] : [];
      })
    : [];

const TEXT_RULES = {
  full_name: stripLeaveRemark,
  academic_position: stripLeaveRemark,
  qualifications: stripContactDetails,
  research_interests: stripContactDetails,
};
const METRIC_COLUMNS = ["total_publications", "total_citations", "citations_2021_2025", "h_index", "total_q1_journal_publications", "q1_publications_2021_2025", "research_metrics_source", "metrics_source_url"];

export function redactRow(row, research) {
  const changes = [];
  const set = (col, value) => {
    if (row[col] !== undefined && row[col] !== value) {
      changes.push({ col, original: row[col] });
      row[col] = value;
    }
  };
  const rejected = rejectedProfileKeys(row, research);
  if (rejected.size) {
    const metricsFromRejected = !row.metrics_source_url || rejected.has(profileKey(row.metrics_source_url));
    for (const col of ["google_scholar_url", "researchgate_url"]) if (row[col] && rejected.has(profileKey(row[col]))) set(col, "");
    if (metricsFromRejected && /scholar|researchgate/i.test(row.research_metrics_source || "")) for (const col of METRIC_COLUMNS) set(col, "");
  }
  for (const [col, fn] of Object.entries(TEXT_RULES)) if (row[col]) set(col, fn(row[col]));
  return changes;
}

const research = researchInputs(SOURCE);
const archive = [];
let files = 0, rows = 0;
for (const file of walk(`${SOURCE}/universities`)) {
  const raw = fs.readFileSync(file);
  const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const text = raw.toString("utf8").replace(/^﻿/, "");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  let touched = false;
  for (const row of parsed.data) {
    const changes = redactRow(row, research);
    if (!changes.length) continue;
    touched = true;
    rows++;
    for (const c of changes) archive.push({ redacted_at: new Date().toISOString().slice(0, 10), academic_id: row.academic_id, university: row.university, column: c.col, original_value: c.original, file: file.replace(/\\/g, "/") });
    console.log(`${row.academic_id}  ${changes.map((c) => c.col).join(", ")}`);
  }
  if (touched) {
    files++;
    if (apply) fs.writeFileSync(file, (bom ? "﻿" : "") + Papa.unparse(parsed.data, { columns: parsed.meta.fields, newline: eol }) + eol);
  }
}
if (apply && archive.length) {
  fs.mkdirSync(path.dirname(ARCHIVE), { recursive: true });
  const exists = fs.existsSync(ARCHIVE);
  const csv = Papa.unparse(archive, { header: !exists, newline: "\n" });
  fs.appendFileSync(ARCHIVE, (exists ? "\n" : "﻿") + csv + "\n");
}
console.log(`${apply ? "Redacted" : "Would redact"} ${rows} record(s) in ${files} file(s)${apply && archive.length ? `; originals saved privately in ${ARCHIVE}` : ""}.`);
