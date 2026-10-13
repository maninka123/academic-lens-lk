import { describe, it, expect } from "vitest";
import type { Academic } from "../types";
import {
  withProvider,
  quality,
  logSplit,
  coverageOf,
  isMatched,
  providerOf,
} from "./quality";
import { compare, aggregate } from "./engine";
import { defaultConfig } from "../store";
import { statisticsCsv } from "./exports";

const base: Academic = {
  id: "x",
  name: "x",
  universityId: "u",
  university: "U",
  facultyId: "u--f",
  faculty: "F",
  departmentId: "u--f--d",
  department: "D",
  type: "Public",
  position: "Lecturer",
  rank: "Lecturer",
  qualification: "Unknown",
  qualifications: "",
  phdUniversity: "",
  phdCountry: "",
  phdYear: null,
  phdStatus: "",
  experience: null,
  interests: "",
  publications: null,
  citations: null,
  recentCitations: null,
  hIndex: null,
  q1: null,
  recentQ1: null,
  sourceUrl: "",
  scholarUrl: "",
  researchgateUrl: "",
  metricsUrl: "",
  metricsSource: "",
  collectionDate: "2026-01-01",
  snapshotDate: "",
  status: "",
  employmentStatus: "",
  field: "Unmapped",
  notes: "",
} as Academic;
const mk = (id: string, x: Partial<Academic> = {}): Academic => ({
  ...base,
  id,
  name: id,
  ...x,
});
const scholar = (id: string, citations: number | null, u = "u") =>
  mk(id, {
    universityId: u,
    university: u,
    citations,
    metricsSource: "Google Scholar",
  });
const rg = (id: string, citations: number | null) =>
  mk(id, { citations, metricsSource: "ResearchGate" });

describe("single-provider comparisons", () => {
  it("excludes values from other providers as missing, not zero", () => {
    const { rows, excluded } = withProvider(
      [scholar("a", 10), rg("b", 500), scholar("c", null)],
      "Google Scholar",
    );
    expect(rows.map((r) => r.citations)).toEqual([10, null, null]);
    expect(excluded).toBe(1);
  });
  it("uses field-level evidence over the record-level source", () => {
    const a = mk("a", {
      citations: 40,
      publications: 12,
      metricsSource: "Mixed: Google Scholar; ResearchGate",
      metricEvidence: [
        {
          metric: "citations",
          value: 40,
          source: "Google Scholar",
          url: "",
          date: "2026-02-01",
        },
        {
          metric: "publications",
          value: 12,
          source: "ResearchGate",
          url: "",
          date: "2026-02-01",
        },
      ],
    } as Partial<Academic>);
    expect(providerOf(a, "citations")).toBe("Google Scholar");
    expect(providerOf(a, "publications")).toBe("ResearchGate");
    const { rows } = withProvider([a], "Google Scholar");
    expect(rows[0].citations).toBe(40);
    expect(rows[0].publications).toBeNull();
  });
  it("takes OpenAlex values for Sri Lanka only from successful matches", () => {
    const oa = new Map([
      [
        "a",
        {
          status: "openalex_matched_surname_initials_and_institution",
          hIndex: 7,
        },
      ],
      [
        "b",
        { status: "openalex_multiple_candidates_requires_review", hIndex: 30 },
      ],
      ["c", { status: "openalex_no_name_match_at_institution", hIndex: 2 }],
    ]);
    const { rows } = withProvider(
      [scholar("a", 5), scholar("b", 5), scholar("c", 5), scholar("d", 5)],
      "OpenAlex",
      oa,
    );
    expect(rows.map((r) => r.hIndex)).toEqual([7, null, null, null]);
    expect(rows.every((r) => r.citations === null)).toBe(true);
  });
  it("does not treat unmatched or review statuses as matches", () => {
    expect(isMatched("openalex_matched_name_and_institution")).toBe(true);
    expect(isMatched("unmatched")).toBe(false);
    expect(isMatched("openalex_not_matched")).toBe(false);
    expect(isMatched("openalex_no_name_match_at_institution")).toBe(false);
    expect(isMatched(undefined)).toBe(false);
  });
});

describe("missing versus zero", () => {
  it("keeps zero as a value and missing out of the denominator", () => {
    const rows = [scholar("a", 0), scholar("b", null), scholar("c", 20)];
    const q = quality(rows, "citations", 2);
    expect(q).toMatchObject({ eligible: 3, valid: 2, missing: 1, lowN: false });
    expect(q.completeness).toBeCloseTo(66.67, 1);
    expect(aggregate(rows, "citations", "median").value).toBe(10);
  });
  it("flags weak coverage and small samples", () => {
    const rows = [
      scholar("a", 3),
      ...Array.from({ length: 9 }, (_, i) => scholar("m" + i, null)),
    ];
    const q = quality(rows, "citations");
    expect(q.lowN).toBe(true);
    expect(q.weak).toBe(true);
  });
  it("excludes non-positive values from log axes instead of shifting them", () => {
    expect(logSplit([0, null, 1, 5, -2])).toEqual({
      positive: [1, 5],
      excluded: 2,
    });
  });
});

describe("small-sample comparisons", () => {
  it("flags groups below the minimum and never ranks them first", () => {
    const big = Array.from({ length: 12 }, (_, i) =>
      scholar("b" + i, 10, "big"),
    );
    const small = [scholar("s1", 9000, "small"), scholar("s2", 8000, "small")];
    const out = compare([...big, ...small], {
      ...defaultConfig,
      level: "university",
      metric: "citations",
      aggregation: "median",
      sort: "value",
      groups: [],
    });
    expect(out.map((g) => [g.id, g.lowN])).toEqual([
      ["big", false],
      ["small", true],
    ]);
  });
  it("exports the counts and flags alongside each value", () => {
    const csv = statisticsCsv(
      {
        title: "t",
        population: "p",
        filters: { university: "" },
        metric: "Citations",
        metricDefinition: "d",
        provider: "Google Scholar",
        aggregation: "Median",
        datasetVersion: "v1",
        window: "w",
        minimumSample: 10,
      },
      [
        {
          group: "U",
          value: 4,
          valid: 3,
          eligible: 12,
          flag: "n < 10: not ranked",
        },
      ],
    );
    expect(csv).toMatch(/# Dataset version: v1/);
    expect(csv).toMatch(/# Filter: university: all/);
    expect(csv).toMatch(/U,4,3,9,12,25,,,n < 10: not ranked/);
  });
});

describe("coverage indicators", () => {
  it("counts approved public OpenAlex identities and excludes staged matches", () => {
    expect(coverageOf([
      mk("approved", { openAlexStatus: "openalex_matched_confirmed", openAlexUrl: "https://openalex.org/A1" }),
      mk("pending", { openAlexStatus: "openalex_matched_confirmed", openAlexUrl: "" }),
    ] as Academic[]).verifiedIdentity).toBe(1);
  });
  it("separates verified identity, employment, metrics and review", () => {
    const c = coverageOf([
      mk("a", {
        scholarStatus: "verified_official_link",
        citations: 1,
        employmentStatus: "permanent_officially_listed",
      }),
      mk("b", { scholarStatus: "candidate_needs_review" }),
      mk("c", { doctorateStatus: "contradictory", qualifications: "PhD" }),
    ] as Academic[]);
    expect(c).toMatchObject({
      records: 3,
      verifiedIdentity: 1,
      verifiedEmployment: 1,
      withMetric: 1,
      withQualifications: 1,
      needsReview: 2,
    });
  });
});
