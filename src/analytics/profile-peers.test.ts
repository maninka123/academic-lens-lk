import { describe, expect, it } from "vitest";
import type { Academic } from "../types";
import { buildPeerGroups } from "./profile-peers";

const base = {
  universityId: "u",
  university: "University",
  facultyId: "f",
  faculty: "Science",
  departmentId: "d",
  department: "Chemistry",
  rank: "Senior Professor",
  position: "Senior Professor",
  type: "Public",
  qualification: "PhD",
  field: "Unmapped",
  metricsSource: "Google Scholar",
  citations: null,
  publications: null,
  hIndex: null,
  recentCitations: null,
  q1: null,
  recentQ1: null,
} as Academic;
const citations = [
  25, 204, 246, 553, 640, 878, 1355, 1495, 2651, 5231, 41498, 1, 159, 563, 573,
  1117,
];
const rows = Array.from({ length: 40 }, (_, i) => ({
  ...base,
  id: "p" + i,
  name: "Person " + i,
  citations: citations[i] ?? null,
  universityId: i < 11 || (i >= 16 && i < 28) ? "u" : "v",
  facultyId: i > 0 && i < 11 ? "f" : "other",
  departmentId: [7, 8, 9].includes(i) ? "d" : "other",
  qualification: i < 24 ? "PhD" : "Unknown",
}));
const a = rows[9];
const group = (key: string) =>
  buildPeerGroups(rows, a, "citations", "position").groups.find(
    (g) => g.key === key,
  )!;
describe("profile peer calculations", () => {
  it("reproduces the screenshot medians and midrank percentiles", () => {
    expect(group("faculty").members).toHaveLength(10);
    expect(group("faculty").median).toBe(1116.5);
    expect(group("faculty").percentile).toBe(85);
    expect(group("university").members).toHaveLength(23);
    expect(group("university").n).toBe(11);
    expect(group("university").median).toBe(878);
    expect(group("university").percentile).toBeCloseTo(86.363636);
    expect(group("all").median).toBe(606.5);
    expect(group("all").percentile).toBe(90.625);
    expect(group("qualification").members).toHaveLength(24);
    expect(group("all").members).toHaveLength(40);
    expect(
      group("all")
        .v.slice()
        .sort((a, b) => a - b),
    ).toEqual(
      group("qualification")
        .v.slice()
        .sort((a, b) => a - b),
    );
  });
  it("keeps missing values out, suppresses statistics under ten, and includes the person once", () => {
    expect(group("department").n).toBe(3);
    expect(group("department").median).toBeNull();
    expect(group("department").percentile).toBeNull();
    expect(
      buildPeerGroups([...rows, a], a, "citations", "position").groups.find(
        (g) => g.key === "all",
      )!.n,
    ).toBe(16);
  });
  it("keeps sources separate and counts zero as a measured value", () => {
    const mixed = rows.map((r) =>
      r.id === "p0"
        ? { ...r, citations: 0 }
        : r.id === "p1"
          ? { ...r, metricsSource: "OpenAlex" }
          : r,
    );
    const all = buildPeerGroups(mixed, a, "citations", "all").groups.find(
      (g) => g.key === "all",
    )!;
    expect(all.n).toBe(15);
    expect(all.v).toContain(0);
    expect(all.v).not.toContain(204);
  });
  it("does not match unknown fields, positions, or qualifications as real categories", () => {
    const person = {
      ...a,
      rank: "Unknown",
      position: "Unknown",
      qualification: "Unknown",
      field: "Unclassified",
    };
    const result = buildPeerGroups([{ ...person }], person, "citations", "all");
    for (const key of ["rank", "qualification", "field"])
      expect(result.groups.find((g) => g.key === key)!.members).toHaveLength(0);
  });
  it("does not imply all positions when a cohort is selected", () => {
    expect(group("all").label).toBe("All selected peers");
    expect(group("all").description).toContain(
      "Senior Professor positions only",
    );
    expect(
      buildPeerGroups(rows, a, "citations", "all").groups.find(
        (g) => g.key === "all",
      )!.label,
    ).toBe("All collected profiles");
  });
  it("handles ties and a missing personal measurement", () => {
    const tied = Array.from({ length: 10 }, (_, i) => ({
      ...a,
      id: String(i),
      citations: i < 5 ? 0 : 10,
    }));
    const result = buildPeerGroups(
      tied,
      { ...a, citations: 10 },
      "citations",
      "all",
    );
    expect(result.groups.find((g) => g.key === "all")!.percentile).toBe(75);
    expect(
      buildPeerGroups(
        tied,
        { ...a, citations: null },
        "citations",
        "all",
      ).groups.find((g) => g.key === "all")!.percentile,
    ).toBeNull();
  });
});
