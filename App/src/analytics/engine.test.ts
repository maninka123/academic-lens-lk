import { describe, it, expect } from "vitest";
import {
  sum,
  mean,
  median,
  quantile,
  summary,
  percentile,
  values,
  aggregate,
  compare,
  filterAcademics,
  validModes,
  peers,
  completeness,
} from "./engine";
import type { Academic } from "../types";
import { defaultConfig, emptyFilters } from "../store";
const a = (
  id: string,
  u: string,
  citations: number | null,
  type: "Public" | "Non-state" = "Public",
  extra: Partial<Academic> = {},
): Academic => ({
  id,
  name: id,
  universityId: u,
  university: u,
  facultyId: u + "-eng",
  faculty: "Engineering",
  departmentId: u + "-civil",
  department: "Civil",
  type,
  position: "Senior Lecturer Grade I",
  rank: "Senior Lecturer",
  qualification: "Unknown",
  qualifications: "",
  phdUniversity: "",
  phdCountry: "",
  phdYear: null,
  phdStatus: "unknown",
  experience: null,
  interests: "",
  publications: null,
  citations,
  recentCitations: null,
  hIndex: null,
  q1: null,
  recentQ1: null,
  sourceUrl: "",
  scholarUrl: "",
  metricsUrl: "",
  metricsSource: "",
  collectionDate: "",
  snapshotDate: "",
  status: "",
  employmentStatus: "",
  field: "Unmapped",
  notes: "",
  ...extra,
});
describe("documented statistics", () => {
  it("handles zeros, nulls and empty samples", () => {
    expect(values([0, null, undefined, 10, NaN, Infinity])).toEqual([0, 10]);
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(summary([]).min).toBeNull();
    expect(sum([0, 10])).toBe(10);
  });
  it("calculates interpolated quartiles and population SD", () => {
    expect(median([9, 1, 3, 7])).toBe(5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(summary([1, 2, 3, 4]).iqr).toBe(1.5);
    expect(summary([1, 2, 3, 4]).sd).toBeCloseTo(Math.sqrt(1.25));
  });
  it("handles percentile ties and small samples", () => {
    expect(percentile([1, 2, 2, 4, 5], 2)).toBe(40);
    expect(percentile([1, 2, 3], 2)).toBeNull();
    expect(percentile([1, 2, 3, 4, 5], null)).toBeNull();
  });
});
describe("comparisons", () => {
  it("recalculates total, mean and median over valid records", () => {
    const rows = [
      a("1", "moratuwa", null, "Public", { recentCitations: 10 }),
      a("2", "moratuwa", null, "Public", { recentCitations: 30 }),
      a("3", "moratuwa", null),
      a("4", "peradeniya", null, "Public", { recentCitations: 100 }),
    ];
    for (const [mode, value] of [
      ["total", 40],
      ["mean", 20],
      ["median", 20],
    ] as const) {
      const g = compare(rows, {
        ...defaultConfig,
        metric: "recentCitations",
        aggregation: mode,
        groups: ["moratuwa"],
      });
      expect(g[0].value).toBe(value);
      expect(g[0].n).toBe(2);
      expect(g[0].total).toBe(3);
    }
  });
  it("removing a citation never turns missing into zero", () => {
    const rows = [a("1", "a", 0), a("2", "a", null), a("3", "a", 20)];
    expect(aggregate(rows, "citations", "mean")).toEqual({
      value: 10,
      n: 2,
      total: 3,
    });
    expect(completeness(rows, "citations")).toBeCloseTo(200 / 3);
  });
  it("university weighting changes a pooled median", () => {
    const rows = [
      a("1", "a", 0),
      a("2", "a", 0),
      a("3", "a", 0),
      a("4", "b", 100),
      a("5", "c", 40, "Non-state"),
    ];
    const pooled = compare(rows, {
      ...defaultConfig,
      level: "type",
      weight: "pooled",
    });
    const equal = compare(rows, {
      ...defaultConfig,
      level: "type",
      weight: "equal",
    });
    expect(pooled.find((g) => g.id === "Public")!.value).toBe(0);
    expect(equal.find((g) => g.id === "Public")!.value).toBe(50);
    expect(equal.find((g) => g.id === "Public")!.n).toBe(4);
    expect(equal.find((g) => g.id === "Public")!.universityN).toBe(2);
  });
  it("does not offer h-index summation", () => {
    expect(validModes("hIndex")).not.toContain("total");
    expect(validModes("hIndex")).not.toContain("per10");
  });
  it("uses known qualification and country denominators", () => {
    const rows = [
      a("1", "a", 0, "Public", {
        qualification: "PhD",
        phdCountry: "Australia",
      }),
      a("2", "a", 0, "Public", { qualification: "Masters / MPhil" }),
      a("3", "a", null),
    ];
    expect(aggregate(rows, "phd", "percentage")).toEqual({
      value: 50,
      n: 2,
      total: 3,
    });
    expect(aggregate(rows, "overseas", "percentage")).toEqual({
      value: 100,
      n: 1,
      total: 3,
    });
  });
  it("selects faculties, departments and manually mapped equivalent fields", () => {
    const rows = [
      a("1", "a", 10, "Public", { field: "Engineering" }),
      a("2", "b", 30, "Public", { field: "Engineering" }),
      a("3", "b", 100),
    ];
    const f = { ...emptyFilters(), fields: ["Engineering"] };
    expect(filterAcademics(rows, f).map((a) => a.id)).toEqual(["1", "2"]);
    expect(
      compare(rows, {
        ...defaultConfig,
        level: "department",
        groups: ["a-civil", "b-civil"],
      }).map((g) => g.n),
    ).toEqual([1, 2]);
  });
  it("respects peer definitions and does not infer missing units", () => {
    const rows = [
      a("1", "a", 10),
      a("2", "a", 20),
      a("3", "b", 50, "Non-state", { rank: "Professor" }),
    ];
    expect(peers(rows, rows[0], "department").length).toBe(2);
    expect(peers(rows, rows[0], "rank").length).toBe(2);
    expect(peers(rows, { ...rows[0], departmentId: "" }, "department")).toEqual(
      [],
    );
    expect(peers(rows, rows[0], "field")).toEqual([]);
  });
  it("handles named custom groups, overlapping membership and valid counts", () => {
    const rows = [a("1", "a", 10), a("2", "b", null), a("3", "c", 20)];
    const g = compare(rows, { ...defaultConfig, level: "custom" }, [
      { id: "g1", name: "A", ids: ["1", "2"] },
      { id: "g2", name: "B", ids: ["1", "3"] },
    ]);
    expect(g.map((g) => g.value)).toEqual([10, 15]);
    expect(g.map((g) => g.n)).toEqual([1, 2]);
  });
});
