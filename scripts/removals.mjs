#!/usr/bin/env node
// Applies an accepted removal request promptly and makes it permanent.
//
//   node scripts/removals.mjs add <academic_id> --reason "<short reason>" [--ref "<request reference>"]
//   node scripts/removals.mjs list      private list (IDs, dates, reasons; no personal details beyond name and university)
//   node scripts/removals.mjs check     verify that no removed person is in the source files or the published data
//
// `add` does four things, in order, and only then touches the public files:
//   1. archives the complete source row privately (Data files/_research_reviews/removed_records.csv)
//   2. records the request in the private list (Data files/removal_requests.csv)
//   3. deletes the row from the tracked source CSV
//   4. you then run `npm run data:import`, `npm run check:privacy` and `npm test`, commit and push.
// From then on the importer withholds that ID and that name at that university, and the privacy guard fails
// if the person reappears in public/data or in the tracked source CSVs.
// Both private files are git-ignored. Public removal from GitHub's own caches and old history is a separate
// step (see docs/PRIVACY_SAFEGUARDS.md, "Applying a removal request").
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { loadRemovals, isRemoved, removalsPath, removedArchivePath } from "./removals-lib.mjs";

const SOURCE = process.env.DATA_SOURCE || "Data files";
const [, , cmd = "list", ...rest] = process.argv;
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : "";
};
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : e.name === "academics.csv" ? [p] : [];
      })
    : [];
const readCsv = (file) => {
  const raw = fs.readFileSync(file);
  const text = raw.toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return { rows: parsed.data, fields: parsed.meta.fields, bom: raw[0] === 0xef, eol: text.includes("\r\n") ? "\r\n" : "\n" };
};
const writeCsv = (file, { rows, fields, bom, eol }) =>
  fs.writeFileSync(file, (bom ? "﻿" : "") + Papa.unparse(rows, { columns: fields, newline: eol }) + eol);
const today = new Date().toISOString().slice(0, 10);

function appendPrivate(file, rows, columns) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const exists = fs.existsSync(file);
  fs.appendFileSync(file, (exists ? "" : "﻿") + Papa.unparse(rows, { columns, header: !exists, newline: "\n" }) + "\n");
}

if (cmd === "add") {
  const id = rest.find((a) => /^SL-[0-9a-f]{12}$/.test(a));
  if (!id) throw Error('Usage: removals.mjs add SL-xxxxxxxxxxxx --reason "..." [--ref "..."]');
  const hits = walk(`${SOURCE}/universities`).flatMap((file) => readCsv(file).rows.filter((r) => r.academic_id === id).map((r) => ({ file, r })));
  if (hits.length === 0) throw Error(`${id} is not in the source files (already removed?). Nothing changed.`);
  const first = hits[0].r;
  const columns = Object.keys(first);
  appendPrivate(removedArchivePath(SOURCE), hits.map(({ r, file }) => ({ removed_at: today, source_file: file, ...r })), ["removed_at", "source_file", ...columns]);
  appendPrivate(
    removalsPath(SOURCE),
    [{ academic_id: id, full_name: first.full_name, university: first.university, requested_at: flag("requested") || today, applied_at: today, reason: flag("reason"), reference: flag("ref") }],
    ["academic_id", "full_name", "university", "requested_at", "applied_at", "reason", "reference"],
  );
  for (const file of new Set(hits.map((h) => h.file))) {
    const csv = readCsv(file);
    csv.rows = csv.rows.filter((r) => r.academic_id !== id);
    writeCsv(file, csv);
  }
  console.log(`Removed ${id} from ${hits.length} source file(s); full copy archived privately.`);
  console.log("Next: npm run data:import && npm run check:privacy && npm test, then commit and push.");
} else if (cmd === "list") {
  const r = loadRemovals(SOURCE);
  console.log(r.exists ? `${r.rows.length} accepted removal(s) on the private list (${r.file}).` : "No removal list yet.");
  for (const row of r.rows) console.log(`${row.academic_id}  applied ${row.applied_at}  ${row.reason || ""}`);
} else if (cmd === "check") {
  const removals = loadRemovals(SOURCE);
  const problems = [];
  for (const file of walk(`${SOURCE}/universities`)) for (const r of readCsv(file).rows) if (isRemoved(r, removals)) problems.push(`${r.academic_id} is back in ${file}`);
  if (fs.existsSync("public/data/academics.csv")) {
    const pub = readCsv("public/data/academics.csv").rows;
    for (const r of pub) if (removals.ids.has(r.id)) problems.push(`${r.id} is in public/data/academics.csv`);
  }
  if (problems.length) {
    console.error("Removal check failed:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  console.log(`Removal check passed (${removals.rows.length} accepted removal(s)).`);
} else throw Error("Usage: removals.mjs add | list | check");
