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
