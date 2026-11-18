// Accepted removal requests: kept in a private, git-ignored list and enforced on every import.
//
// `Data/removal_requests.csv` (private) has one row per removed person:
//   academic_id, full_name, university, requested_at, applied_at, reason, reference
// The importer drops any source record that matches by ID or by normalised name and university, so a removed
// person cannot come back through re-collection, an old backup or a restored CSV. Full original rows are kept
// privately in `Data/_research_reviews/removed_records.csv`. Nothing in this list is ever published.
import fs from "node:fs";
import Papa from "papaparse";

export const removalsPath = (source = "../Data") => `${source}/removal_requests.csv`;
export const removedArchivePath = (source = "../Data") => `${source}/_research_reviews/removed_records.csv`;

const TITLES = /\b(prof(essor)?|dr|mr|mrs|ms|miss|rev|ven|snr|sr|eng|ir|ch|hon)\b\.?/gi;
/** Name without titles, punctuation, spacing or case: "Prof. A.B. Perera" and "a b perera" agree. */
export const normaliseName = (name) =>
  String(name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, " ").replace(TITLES, " ").replace(/[^a-z]/gi, "").toLowerCase();
const nameKey = (name, university) => `${normaliseName(university)}|${normaliseName(name)}`;

export function loadRemovals(source = "../Data") {
  const file = removalsPath(source);
  const empty = { ids: new Set(), keys: new Set(), rows: [], file, exists: false };
  if (!fs.existsSync(file)) return empty;
  const rows = Papa.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data;
  return {
    ids: new Set(rows.map((r) => (r.academic_id || "").trim()).filter(Boolean)),
    keys: new Set(rows.filter((r) => r.full_name && r.university).map((r) => nameKey(r.full_name, r.university))),
    rows,
    file,
    exists: true,
  };
}

/** True when a source record (academic_id, full_name, university) was removed on request. */
export const isRemoved = (row, removals) =>
  removals.ids.has(String(row.academic_id ?? "").trim()) || (Boolean(row.full_name && row.university) && removals.keys.has(nameKey(row.full_name, row.university)));
