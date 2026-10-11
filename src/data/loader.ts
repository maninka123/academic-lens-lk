import Papa from "papaparse";
import type {
  Academic,
  Coverage,
  Dataset,
  DatasetSummary,
  University,
  Metadata,
} from "../types";
import { academicDisplayName } from "./names";
const numeric = [
  "phdYear",
  "experience",
  "publications",
  "citations",
  "recentCitations",
  "hIndex",
  "q1",
  "recentQ1",
];
export async function loadDataset(): Promise<Dataset> {
  const dir = import.meta.env.BASE_URL + "data/";
  const fetchText = async (name: string) => {
    const r = await fetch(dir + name + "?v=" + import.meta.env.VITE_DATA_REVISION);
    if (!r.ok) throw Error(`Cannot load ${name} (${r.status}).`);
    return r.text();
  };
  const [a, u, m, cov, sum] = await Promise.all([
    fetchText("academics.csv"),
    fetchText("universities.csv"),
    fetchText("metadata.json"),
    fetchText("coverage_summary.csv").catch(() => ""),
    fetchText("dataset_summary.json").catch(() => ""),
  ]);
  const parse = (s: string) => {
    const result = Papa.parse<Record<string, string>>(s, {
      header: true,
      skipEmptyLines: true,
    });
    if (result.errors.length) throw Error(result.errors[0].message);
    return result.data;
  };
  const academics = parse(a).map((r) => {
    const row: Record<string, unknown> = { ...r };
    row.sourceName = r.name;
    // Files without a doctorate status column (older snapshots, test fixtures):
    // the importer only ever assigns "PhD" to documented completed doctorates.
    if (!r.doctorateStatus)
      row.doctorateStatus =
        r.qualification === "PhD" ? "completed_documented" : "unknown";
    row.name = academicDisplayName({
      name: r.name,
      qualification: r.qualification,
      phdStatus: r.phdStatus,
      qualifications: r.qualifications,
      doctorateStatus: row.doctorateStatus as Academic["doctorateStatus"],
    });
    if (r.metricEvidence) {
      const evidence = JSON.parse(r.metricEvidence);
      if (
        !Array.isArray(evidence) ||
        evidence.some(
          (e) =>
            !e ||
            typeof e.metric !== "string" ||
            !Number.isFinite(e.value) ||
            ["source", "url", "date", "note"].some(
              (k) => typeof e[k] !== "string",
            ),
        )
      )
        throw Error(`Invalid metric evidence for ${r.id}`);
      row.metricEvidence = evidence;
    }
    for (const k of numeric) {
      const n = r[k]?.trim() === "" ? null : Number(r[k]);
      if (n !== null && (!Number.isFinite(n) || n < 0))
        throw Error(`Invalid ${k} for ${r.id}`);
      row[k] = n;
    }
    return row as Academic;
  });
  const universities = parse(u) as University[];
  const metadata = JSON.parse(m) as Metadata;
  if (
    !Array.isArray(metadata.window) ||
    metadata.window.length !== 2 ||
    !metadata.window.every((v) => Number.isInteger(v)) ||
    metadata.window[0] > metadata.window[1] ||
    !metadata.version ||
    metadata.mode !== "real"
  )
    throw Error("Invalid metadata");
  if (
    new Set(universities.map((u) => u.id)).size !== universities.length ||
    universities.some(
      (u) => !u.id || !u.name || !["Public", "Non-state"].includes(u.type),
    )
  )
    throw Error("Invalid institution inventory");
  const ids = new Set<string>();
  for (const r of academics) {
    if (
      !r.id ||
      !r.name ||
      ids.has(r.id) ||
      !universities.some((u) => u.id === r.universityId)
    )
      throw Error("Invalid or duplicate academic record");
    ids.add(r.id);
  }
  {
    const mapping = JSON.parse(await fetchText("field-mapping.json"));
    if (!mapping.departments || !mapping.faculties)
      throw Error("Invalid field mapping");
    for (const a of academics)
      a.field =
        mapping.departments[a.departmentId] ||
        mapping.faculties[a.facultyId] ||
        "Unmapped";
  }
  const coverage = (cov ? parse(cov) : []).map((r) => {
    const row: Record<string, unknown> = { ...r };
    for (const [k, v] of Object.entries(r))
      if (
        k !== "university" &&
        k !== "university_id" &&
        k !== "type" &&
        k !== "roster_status"
      )
        row[k] = Number(v);
    return row as Coverage;
  });
  const summary = sum ? (JSON.parse(sum) as DatasetSummary) : null;
  return { academics, universities, metadata, coverage, summary };
}
