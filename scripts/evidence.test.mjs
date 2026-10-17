import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveAlias,
  linkStatus,
  metricEvidence,
  normaliseRank,
  openAlexFallback,
} from "./evidence.mjs";
test("OpenAlex fills absent app metrics without replacing recorded provider values", () => {
  const row = { total_publications: "", total_citations: "101", h_index: "0" };
  const lookup = { openalex_id: "https://openalex.org/A1", status: "openalex_matched_name_and_institution",
    total_publications: "9", total_citations: "999", h_index: "8", citations_2021_2025: "0" };
  const result = openAlexFallback(row, lookup);
  assert.deepEqual(result.fields, { total_publications: "9", citations_2021_2025: "0" });
  assert.equal(result.evidence[0].source, "OpenAlex");
  assert.equal(result.evidence[0].date, "");
  assert.equal(row.total_citations, "101");
  assert.deepEqual(openAlexFallback(row, { ...lookup, status: "openalex_multiple_candidates_requires_review" }).fields, {});
});
test("aliases retain identity and reject cycles", () => {
  assert.equal(
    resolveAlias("old", { old: "middle", middle: "current" }),
    "current",
  );
  assert.throws(() => resolveAlias("a", { a: "b", b: "a" }), /Circular/);
});
test("research status is matched to the actual platform identity", () => {
  const evidence = [
    {
      academic_id: "old",
      profile_url: "https://scholar.google.com/citations?user=wrong",
      checked_at: "2026-10-11",
      identity_verification_status: "rejected_different_person",
    },
  ];
  assert.equal(
    linkStatus(
      "current",
      "https://scholar.google.com/citations?hl=en&user=wrong",
      evidence,
      { old: "current" },
    ),
    "rejected_different_person",
  );
  assert.equal(
    linkStatus(
      "current",
      "https://scholar.google.com/citations?user=correct",
      evidence,
      { old: "current" },
    ),
    "recorded_unverified",
  );
});
test("mixed-platform metrics retain independent sources and dates", () => {
  const row = {
    academic_id: "a",
    total_publications: "20",
    total_citations: "123",
    h_index: "5",
  };
  const evidence = metricEvidence(
    row,
    [
      {
        academic_id: "a",
        publications: "20",
        citations: "90",
        source: "ResearchGate",
        profile_url: "https://www.researchgate.net/profile/A",
        retrieved_at: "2025-01-01",
        freshness: "indexed",
      },
    ],
    [
      {
        academic_id: "a",
        metric: "total_citations",
        value: "123",
        platform: "Google Scholar",
        source_url: "https://scholar.google.com/citations?user=a",
        retrieved_at: "2026-10-11",
        notes: "live",
      },
    ],
    {},
  );
  assert.equal(evidence[0].source, "ResearchGate");
  assert.equal(evidence[1].source, "Google Scholar");
  assert.equal(evidence[2].date, "");
  assert.equal(normaliseRank("Assistant Professor"), "Assistant Professor");
  assert.equal(normaliseRank(""), "Unknown");
});

import {
  doctorateStatus,
  sanitizeUrl,
  sanitizeText,
  providerOf,
} from "./evidence.mjs";
import { rankFor, careerStage } from "./countries.mjs";

test("a completed doctorate needs explicit evidence", () => {
  const s = (phd_status, qualifications) =>
    doctorateStatus({ phd_status, qualifications });
  assert.equal(s("listed_completed", "PhD (Colombo)"), "completed_documented");
  assert.equal(s("", "Ph.D. University of Freiburg"), "completed_documented");
  assert.equal(s("", "BSc, MSc"), "unknown");
  assert.equal(s("", ""), "unknown");
  // A university name or title alone is not completion evidence.
  assert.equal(
    doctorateStatus({ phd_status: "", qualifications: "", phd_university: "University of Leeds" }),
    "unknown",
  );
  assert.equal(s("", "Hon. DSc"), "unknown");
  assert.equal(s("in_progress", "PhD (Reading)"), "in_progress");
  // A closing "(Reading)" after a named university still means reading for the degree.
  assert.equal(s("in_progress", "PhD of Computer Science – University of Murcia , Spain (Reading); Master of Philosophy, University of Moratuwa"), "in_progress");
  assert.equal(s("in_progress", "Doctor of Philosophy Degree – University of Sri Jayewardenepura (Reading); Master of Philosophy – University of Moratuwa"), "in_progress");
  assert.equal(s("", "MSc; Reading for PhD"), "in_progress");
  // A doctorate being pursued is never a completed doctorate.
  assert.equal(s("", "B.A (Hons) (UOJ), M.Phil (UOJ), Ph.D (R) (Aberdeen)"), "in_progress");
  assert.equal(s("", "PhD (FGS, UOC)- Reading, MSc. (KIU)"), "in_progress");
  assert.equal(s("", "PhD (reading), MSc, BSc"), "in_progress");
  assert.equal(s("listed_completed", "Ph.D (R) (University of Aberdeen)"), "contradictory");
  assert.equal(s("", "PhD (in progress); MSc; BSc"), "in_progress");
  // The University of Reading awards completed doctorates.
  assert.equal(s("listed_completed", "Ph.D. Genetics | University of Reading, U.K. | 1990"), "completed_documented");
  assert.equal(s("listed_completed", "B.Sc. (Jaffna); Ph.D. (Reading, UK)"), "completed_documented");
});
test("contradictory doctorate records are flagged, not counted", () => {
  assert.equal(
    doctorateStatus({ phd_status: "listed_completed", qualifications: "PhD (Reading), MSc" }),
    "contradictory",
  );
  assert.equal(
    doctorateStatus({ phd_status: "in_progress", qualifications: "PhD (Moratuwa), MPhil" }),
    "contradictory",
  );
  // A completed PhD alongside a different ongoing degree is not contradictory.
  assert.equal(
    doctorateStatus({ phd_status: "listed_completed", qualifications: "PhD (Kelaniya); reading for DSc" }),
    "completed_documented",
  );
});
test("published URLs lose tokens, sessions and tracking parameters", () => {
  assert.equal(
    sanitizeUrl("https://scholar.google.com/citations?user=ab_CD&hl=en&gmla=AHoSzlX&oi=ao"),
    "https://scholar.google.com/citations?user=ab_CD",
  );
  assert.equal(
    sanitizeUrl("https://x.org/p?token=abc&id=3&utm_source=t#frag"),
    "https://x.org/p?id=3",
  );
  assert.equal(sanitizeUrl("https://user:pass@x.org/a"), "https://x.org/a");
  assert.equal(sanitizeUrl("javascript:alert(1)"), "");
  assert.equal(
    sanitizeUrl("https://example.s3.amazonaws.com/paper.pdf?AWSAccessKeyId=example&Signature=temporary&X-Amz-Credential=example&X-Amz-Expires=900&download=1"),
    "https://example.s3.amazonaws.com/paper.pdf?download=1",
  );
  assert.equal(
    sanitizeText("See https://a.org/x?access_token=1 now"),
    "See https://a.org/x now",
  );
});
test("providers are recognised per value", () => {
  assert.equal(providerOf("Google Scholar"), "Google Scholar");
  assert.equal(providerOf("ResearchGate (search-indexed snapshot)"), "ResearchGate");
  assert.equal(providerOf("Mixed: ResearchGate publications; Google Scholar citations"), "Mixed");
  assert.equal(providerOf(""), "Not recorded");
});
test("country rules map titles without discarding the original", () => {
  assert.equal(rankFor("副教授", "International"), "Associate Professor");
  assert.equal(rankFor("Maître de conférences", "International"), "Lecturer");
  assert.equal(rankFor("Senior Lecturer Grade I"), "Senior Lecturer");
  assert.equal(careerStage("Senior Lecturer"), "Mid-career");
  assert.equal(careerStage("Unknown"), "Unknown");
});
