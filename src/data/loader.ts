import Papa from "papaparse";
import type { Academic, Dataset, University, Metadata } from "../types";
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
export async function loadDataset(mode: "real" | "demo"): Promise<Dataset> {
  const dir =
    import.meta.env.BASE_URL + "data/" + (mode === "demo" ? "demo/" : "");
  const fetchText = async (name: string) => {
    const r = await fetch(dir + name);
    if (!r.ok) throw Error(`Cannot load ${name} (${r.status}).`);
    return r.text();
  };
  const [a, u, m] = await Promise.all([
    fetchText("academics.csv"),
    fetchText("universities.csv"),
    fetchText("metadata.json"),
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
    for (const k of numeric) {
      const n = r[k] === "" ? null : Number(r[k]);
      if (n !== null && (!Number.isFinite(n) || n < 0))
        throw Error(`Invalid ${k} for ${r.id}`);
      row[k] = n;
    }
    return row as Academic;
  });
  const universities = parse(u) as University[];
  const metadata = JSON.parse(m) as Metadata;
  if (!Array.isArray(metadata.window) || !metadata.version)
    throw Error("Invalid metadata");
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
  if (mode === "real") {
    const mapping = JSON.parse(await fetchText("field-mapping.json"));
    for (const a of academics)
      a.field =
        mapping.departments[a.departmentId] ||
        mapping.faculties[a.facultyId] ||
        "Unmapped";
  }
  return { academics, universities, metadata };
}
