// Integrity of the imported public data. Run after `npm run data:import`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { csvRead } from "./shared.mjs";

const ready = fs.existsSync("public/data/academics.csv");
const opts = { skip: !ready && "run npm run data:import first" };

test("academic records are unique and placed in a valid hierarchy", opts, () => {
  const a = csvRead("public/data/academics.csv");
  const unis = new Set(csvRead("public/data/universities.csv").map((u) => u.id));
  const faculties = new Map(csvRead("public/data/faculties.csv").map((f) => [f.id, f]));
  const departments = new Map(csvRead("public/data/departments.csv").map((x) => [x.id, x]));
  assert.equal(new Set(a.map((r) => r.id)).size, a.length);
  for (const r of a) {
    assert.ok(unis.has(r.universityId), `unknown university for ${r.id}`);
    if (r.facultyId) {
      assert.ok(r.facultyId.startsWith(r.universityId + "--"), `faculty outside university for ${r.id}`);
      assert.equal(faculties.get(r.facultyId)?.universityId, r.universityId);
    }
    if (r.departmentId) {
      assert.ok(
        r.departmentId.startsWith((r.facultyId || r.universityId) + "--"),
        `department outside its parent for ${r.id}`,
      );
      assert.equal(departments.get(r.departmentId)?.universityId, r.universityId);
    }
  }
});
test("missing metrics stay blank and numbers are non-negative", opts, () => {
  for (const r of csvRead("public/data/academics.csv"))
    for (const k of ["publications", "citations", "recentCitations", "hIndex", "experience"])
      if (r[k] !== "") assert.ok(Number(r[k]) >= 0 && Number.isFinite(Number(r[k])), `${k} for ${r.id}`);
});
test("PhD qualification is only given for documented completed doctorates", opts, () => {
  for (const r of csvRead("public/data/academics.csv")) {
    if (r.qualification === "PhD") assert.equal(r.doctorateStatus, "completed_documented", r.id);
    if (r.doctorateStatus === "contradictory") assert.notEqual(r.qualificationReview, "", r.id);
  }
});
test("summary, coverage and README describe the same snapshot", opts, () => {
  const a = csvRead("public/data/academics.csv");
  const s = JSON.parse(fs.readFileSync("public/data/dataset_summary.json", "utf8"));
  const m = JSON.parse(fs.readFileSync("public/data/metadata.json", "utf8"));
  const cov = csvRead("public/data/coverage_summary.csv");
  assert.equal(s.academicRecords, a.length);
  assert.equal(s.version, m.version);
  assert.equal(cov.reduce((n, c) => n + Number(c.academic_records), 0), a.length);
  assert.equal(
    s.doctorateDocumented,
    a.filter((r) => r.doctorateStatus === "completed_documented").length,
  );
  const readme = fs.readFileSync("README.md", "utf8");
  assert.match(readme, new RegExp(`Snapshot ${s.version}`));
  assert.match(readme, new RegExp(s.academicRecords.toLocaleString("en")));
});
test("international metrics come only from matched researchers", opts, () => {
  const intl = csvRead("public/data/international/academics.csv");
  for (const r of intl) {
    const hasMetric = ["publications", "citations", "hIndex"].some((k) => r[k] !== "");
    if (hasMetric) assert.match(r.lookupStatus, /(^|_)matched(_|$)/, r.id);
  }
  const sl = csvRead("public/data/international/sri_lanka_openalex.csv");
  for (const r of sl)
    if (r.hIndex !== "" || r.citations !== "") assert.match(r.status, /(^|_)matched(_|$)/, r.id);
  const proxies = intl.filter((r) => r.unitType === "proxy");
  for (const p of proxies) assert.match(p.department, /substitute/i);
});

test("OpenAlex lookups and international bibliographies join to unique academic records", opts, () => {
  const localIds = new Set(csvRead("public/data/academics.csv").map(r => r.id));
  const lookup = csvRead("public/data/international/sri_lanka_openalex.csv");
  assert.equal(new Set(lookup.map(r => r.id)).size, lookup.length);
  for (const r of lookup) assert.ok(localIds.has(r.id), `orphan lookup ${r.id}`);
  const intl = csvRead("public/data/international/academics.csv");
  const intlIds = new Set(intl.map(r => r.id));
  assert.equal(intlIds.size, intl.length);
  for (const r of csvRead("public/data/international/publications.csv"))
    assert.ok(intlIds.has(r.academicId), `orphan bibliography ${r.academicId}`);
  for (const r of intl.filter(r => r.lookupStatus === "not_yet_verified"))
    for (const metric of ["publications", "citations", "recentCitations", "hIndex"])
      assert.equal(r[metric], "", `unverified ${metric} for ${r.id}`);
});

test("an OpenAlex author link is published only for an approved identity match", opts, () => {
  for (const r of csvRead("public/data/academics.csv")) {
    if (r.openAlexUrl)
      assert.ok(
        !["possible", "unresolved", ""].includes(r.openAlexMatchLevel),
        `${r.id} publishes an OpenAlex link with match level "${r.openAlexMatchLevel}"`,
      );
  }
});

test("metrics read from an unverified profile never count as a verified identity", opts, () => {
  // Department of Community Medicine, University of Ruhuna: metrics come from recorded OpenAlex/Scholar
  // author links with no approved match or official link, so the verified-identity count must be zero.
  const verified = (r) =>
    Boolean(r.openAlexUrl) ||
    [r.scholarStatus, r.researchgateStatus].some((s) =>
      ["verified_official_link", "matched_user_supplied_platform_evidence"].includes(s),
    );
  const dept = csvRead("public/data/academics.csv").filter(
    (r) => r.universityId === "ruhuna" && r.department === "Department of Community Medicine",
  );
  assert.ok(dept.length > 0);
  assert.equal(dept.filter(verified).length, 0);
  assert.ok(dept.filter((r) => r.citations !== "" || r.hIndex !== "").length > 0);
});

test("Medicine is mapped to faculties of medicine only; allied health and nursing are separate", () => {
  const m = JSON.parse(fs.readFileSync("../Data/Lanka-Academia/field-mapping.json", "utf8")).faculties;
  for (const [id, field] of Object.entries(m)) {
    if (field === "Medicine") assert.match(id, /faculty-of-medicine$|faculty-of-medical-sciences$/, id);
    if (/allied-health|nursing|health-sciences/.test(id)) assert.equal(field, "Allied Health & Nursing", id);
  }
  for (const id of ["ruhuna", "kelaniya", "kdu", "jayewardenepura"]) {
    assert.ok(Object.entries(m).some(([k, v]) => k.startsWith(id + "--") && v === "Medicine"), `${id} medicine missing`);
  }
});

test("non-academic and ancillary posts are never published", opts, async () => {
  const { isNonAcademicPosition } = await import("./non-academic.mjs");
  for (const r of csvRead("public/data/academics.csv"))
    assert.equal(isNonAcademicPosition(r.position), false, `${r.id}: ${r.position}`);
});

test("registered campuses and schools are faculty-level units with consistent ids and official names", opts, () => {
  const units = csvRead("public/data/organisational_units.csv");
  const unis = new Set(csvRead("public/data/universities.csv").map((u) => u.id));
  const faculties = new Map(csvRead("public/data/faculties.csv").map((f) => [f.id, f]));
  const colombo = units.filter((u) => u.universityId === "colombo").map((u) => u.name);
  assert.ok(colombo.includes("University of Colombo School of Computing (UCSC)"));
  assert.ok(colombo.includes("Sri Palee Campus (SPC)"));
  for (const u of units) {
    assert.ok(unis.has(u.universityId), `unknown university for ${u.id}`);
    assert.ok(u.id.startsWith(u.universityId + "--"), `id outside its university: ${u.id}`);
    assert.equal(u.category, "campus_school");
    assert.equal(faculties.get(u.id)?.name, u.name, `${u.id} missing from faculties.csv`);
  }
});

test("no faculty exists twice as singular/plural folders or variant rows (KDU Allied Health regression)", () => {
  const root = "../Data/Lanka-Academia/universities";
  for (const uni of fs.readdirSync(root)) {
    const base = `${root}/${uni}/faculties`;
    if (!fs.existsSync(base)) continue;
    const stems = new Map();
    for (const folder of fs.readdirSync(base)) {
      const stem = folder.replace(/-\(?fahs\)?$/, "").replace(/s$/, "");
      assert.ok(!stems.has(stem), `${uni}: faculty folders "${stems.get(stem)}" and "${folder}" are duplicates`);
      stems.set(stem, folder);
    }
    const rows = csvRead(`${root}/${uni}/faculties.csv`);
    const seen = new Map();
    for (const r of rows) {
      if (!r.faculty_id || r.faculty_id === "unassigned-faculty") continue;
      const stem = r.faculty_id.replace(/-\(?fahs\)?$/, "").replace(/s$/, "");
      assert.ok(!seen.has(stem), `${uni}: faculties.csv lists "${seen.get(stem)}" and "${r.faculty_id}" as separate faculties`);
      seen.set(stem, r.faculty_id);
    }
  }
});
