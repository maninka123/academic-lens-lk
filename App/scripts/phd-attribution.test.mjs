import test from "node:test";
import assert from "node:assert/strict";
import { doctoralEntries, phdAttribution } from "./phd-attribution.mjs";

const row = (qualifications, phd_university = "", phd_country = "", extra = {}) => ({ qualifications, phd_university, phd_country, ...extra });

test("an adjacent degree's university is not attributed to the doctorate", () => {
  const a = phdAttribution(row("PhD, MA (Nagoya – Japan); BA Honors (Peradeniya)", "University of Peradeniya", "Sri Lanka"));
  assert.notEqual(a.status, "supported");
});
test("a bare doctorate does not inherit an institution", () => {
  assert.equal(phdAttribution(row("BAMS; MPhil (Ayu); PhD", "University of Colombo", "Sri Lanka")).status, "bare_inferred");
  assert.equal(phdAttribution(row("PhD", "University of Colombo", "Sri Lanka")).status, "bare_inferred");
});
test("a joint or split doctorate is never assigned to one institution", () => {
  assert.equal(phdAttribution(row("BA (Hons), MA (Colombo), PhD (USJ-Uppsala)", "University of Sri Jayewardenepura", "Sri Lanka")).status, "joint");
  assert.equal(phdAttribution(row("Split PhD, University of Moratuwa-Host university, University of Warwick-Trainer university, 2009", "University of Moratuwa", "Sri Lanka")).status, "joint");
});
test("a doctorate that names its institution is supported", () => {
  assert.equal(phdAttribution(row("PhD, University of Cincinnati ,1998", "University of Cincinnati", "United States")).status, "supported");
  assert.equal(phdAttribution(row("MSc (Col), PhD (NUS, Singapore)", "National University of Singapore", "Singapore")).status, "supported");
  assert.equal(phdAttribution(row("PhD (Perad.), MSc (Col)", "University of Peradeniya", "Sri Lanka")).status, "supported");
});
test("the country alone can support a doctorate when the institution is abbreviated", () => {
  assert.equal(phdAttribution(row("PhD (Moscow), BSc (Col)", "", "Russia")).status, "supported");
});
test("a value set from a verified official source is trusted over listing text", () => {
  const r = row("PhD, MA (Nagoya – Japan)", "Nagoya University", "Japan", { qualification_evidence: "Verified official_profile https://example.org (checked 2026-11-19)", phd_country_basis: "degree_country_explicit_on_official_profile" });
  assert.equal(phdAttribution(r).status, "supported");
});
test("ongoing doctorates are ignored and unverifiable rows are left alone", () => {
  assert.equal(phdAttribution(row("Reading for PhD (Kelaniya)", "University of Kelaniya", "Sri Lanka")).status, "unverifiable");
  assert.equal(phdAttribution(row("BSc (Col)", "University of Colombo", "Sri Lanka")).status, "unverifiable");
});
test("doctoral entries are classified as named, bare or joint", () => {
  assert.deepEqual(doctoralEntries("PhD (Colombo)").map((e) => e.kind), ["named"]);
  assert.deepEqual(doctoralEntries("PhD").map((e) => e.kind), ["bare"]);
  assert.deepEqual(doctoralEntries("PhD (USJ/Uppsala)").map((e) => e.kind), ["joint"]);
});
