import test from "node:test";
import assert from "node:assert/strict";
import { buildWorklist, scholarId, validateEntry } from "./scholar-yearly.mjs";

const row = (over = {}) => ({
  academic_id: "SL-1", full_name: "A", university: "U",
  google_scholar_url: "https://scholar.google.com/citations?user=ABC123&hl=en",
  total_citations: "500", citations_2021_2025: "", research_lookup_status: "verified_google_scholar", ...over,
});
const entry = (over = {}) => ({
  academic_id: "SL-1", scholar_id: "ABC123", y2021: "10", y2022: "20", y2023: "30", y2024: "40", y2025: "50",
  retrieved_at: "2026-10-16", ...over,
});

test("reads the Scholar id from a profile URL", () => {
  assert.equal(scholarId("https://scholar.google.com/citations?user=ABC123&hl=en"), "ABC123");
  assert.equal(scholarId("not a url"), "");
});
test("worklist includes only people with a Scholar profile and no value yet", () => {
  const rows = [row(), row({ academic_id: "2", citations_2021_2025: "7" }), row({ academic_id: "3", google_scholar_url: "" }),
    row({ academic_id: "4", research_lookup_status: "rejected_different_person" })];
  assert.deepEqual(buildWorklist(rows).map((r) => r.academic_id), ["SL-1"]);
});
test("sums five complete years and keeps zero as a real value", () => {
  assert.equal(validateEntry(entry(), row()).sum, 150);
  assert.equal(validateEntry(entry({ y2021: "0", y2022: "0", y2023: "0", y2024: "0", y2025: "0" }), row()).sum, 0);
});
test("rejects partial years, wrong profile, bad date and impossible totals", () => {
  assert.equal(validateEntry(entry({ y2023: "" }), row()).ok, false);
  assert.equal(validateEntry(entry({ scholar_id: "OTHER" }), row()).ok, false);
  assert.equal(validateEntry(entry({ retrieved_at: "16/10/2026" }), row()).ok, false);
  assert.equal(validateEntry(entry({ y2025: "9999" }), row()).ok, false);
});
test("an untouched worklist line is skipped, not rejected", () => {
  const r = validateEntry(entry({ y2021: "", y2022: "", y2023: "", y2024: "", y2025: "" }), row());
  assert.equal(r.ok, false);
  assert.equal(r.skip, true);
});
