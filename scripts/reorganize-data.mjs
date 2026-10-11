// Run once on the delivered flat collection. Preserves the original bundle in _archive.
import fs from "node:fs";
import path from "node:path";
import { csvRead, csvWrite, universities, slug } from "./shared.mjs";
const root = "Data files";
const source = path.join(root, "Sri_Lanka_Academic_Atlas_Partial_2026-10-11");
if (fs.existsSync(root + "/universities"))
  throw Error(
    "The editable hierarchy already exists. Refusing to overwrite it.",
  );
const rows = csvRead(source + "/academics_all.csv"),
  counts = [];
const batches = new Map();
for (const row of rows) {
  const name = row.university.replace(/ \(SLIIT\)$/, "");
  const uni = universities.find((u) => u.name === name);
  if (!uni) throw Error("Unknown institution " + row.university);
  const faculty = slug(row.faculty) || "unassigned-faculty",
    department = slug(row.department) || "";
  const file =
    `${root}/universities/${uni.id}/faculties/${faculty}/` +
    (department ? `departments/${department}/academics.csv` : "academics.csv");
  if (!batches.has(file)) batches.set(file, []);
  batches.get(file).push(row);
}
const originalHeaders = Object.keys(rows[0]);
for (const u of universities.filter((u) => u.id !== "saegis")) {
  fs.mkdirSync(`${root}/universities/${u.id}/faculties`, { recursive: true });
  const facultyNames = [
    ...new Set(
      rows
        .filter((r) => r.university.replace(/ \(SLIIT\)$/, "") === u.name)
        .map((r) => r.faculty),
    ),
  ];
  const manifest = facultyNames.map((name) => ({
    faculty_id: slug(name) || "unassigned-faculty",
    faculty_name: name || "",
    department_count: new Set(
      rows
        .filter(
          (r) =>
            r.university.replace(/ \(SLIIT\)$/, "") === u.name &&
            r.faculty === name,
        )
        .map((r) => r.department)
        .filter(Boolean),
    ).size,
    academic_records: rows.filter(
      (r) =>
        r.university.replace(/ \(SLIIT\)$/, "") === u.name &&
        r.faculty === name,
    ).length,
  }));
  csvWrite(
    `${root}/universities/${u.id}/faculties.csv`,
    manifest.length
      ? manifest
      : [
          {
            faculty_id: "",
            faculty_name: "",
            department_count: "",
            academic_records: "",
          },
        ],
  );
  if (!facultyNames.length) {
    const f = `${root}/universities/${u.id}/faculties/unassigned-faculty/academics.csv`;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, originalHeaders.join(",") + "\n");
  }
  counts.push({
    ...u,
    academic_records: rows.filter(
      (r) => r.university.replace(/ \(SLIIT\)$/, "") === u.name,
    ).length,
  });
}
for (const [file, batch] of batches) csvWrite(file, batch);
csvWrite(root + "/universities.csv", counts);
const institutionFiles = new Set(
  [
    "colombo",
    "peradeniya",
    "jayewardenepura",
    "kelaniya",
    "moratuwa",
    "jaffna",
    "ruhuna",
    "kdu",
    "sliit",
    "nsbm",
    "cinec",
    "horizon",
    "kiu",
    "icbt",
  ].map((s) => s + "_academics.csv"),
);
for (const file of fs.readdirSync(source)) {
  if (file === "academics_all.csv" || institutionFiles.has(file)) continue;
  if (file === "README.txt")
    fs.copyFileSync(path.join(source, file), root + "/COLLECTION_NOTES.txt");
  else fs.copyFileSync(path.join(source, file), path.join(root, file));
}
const exported = [...batches.values()].flat();
if (
  exported.length !== rows.length ||
  new Set(exported.map((r) => r.academic_id)).size !== rows.length
)
  throw Error("Partition validation failed");
fs.mkdirSync(root + "/_archive", { recursive: true });
fs.renameSync(source, root + "/_archive/original-collection-2026-10-11");
const zip = root + "/Sri_Lanka_Academic_Atlas_Partial_2026-10-11.zip";
if (fs.existsSync(zip))
  fs.renameSync(zip, root + "/_archive/original-delivery.zip");
console.log(
  JSON.stringify(
    {
      records: rows.length,
      universities: counts.length,
      nonemptyCSVs: batches.size,
      facultyGroups: counts.reduce(
        (s, u) =>
          s +
          new Set(
            rows
              .filter((r) => r.university.replace(/ \(SLIIT\)$/, "") === u.name)
              .map((r) => r.faculty),
          ).size,
        0,
      ),
    },
    null,
    2,
  ),
);
