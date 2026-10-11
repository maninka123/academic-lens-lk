import { describe, it, expect, beforeEach } from "vitest";
import type { Academic } from "../types";
import { groupRows, compare } from "./engine";
import { comparisonChart } from "./charts";
import { defaultConfig, useAtlas, emptyFilters } from "../store";
const make = (id: string, n: number | null, extra: Partial<Academic> = {}) =>
  ({
    id,
    name: id,
    universityId: "u",
    university: "University",
    facultyId: "f",
    faculty: "Faculty",
    departmentId: "d",
    department: "Department",
    type: "Public",
    rank: "Lecturer",
    position: "Lecturer",
    qualification: "PhD",
    publications: n,
    citations: n,
    hIndex: n,
    recentCitations: null,
    q1: null,
    recentQ1: null,
    experience: null,
    phdYear: null,
    ...extra,
  }) as Academic;
describe("hierarchy and chart edge cases", () => {
  beforeEach(() =>
    useAtlas.setState({
      config: defaultConfig,
      filters: emptyFilters(),
      custom: [],
    }),
  );
  it("keeps a department-less person at faculty level only", () => {
    const rows = [
      make("named", 10),
      make("faculty-only", 20, { departmentId: "", department: "" }),
    ];
    expect(groupRows(rows, "faculty")[0].rows).toHaveLength(2);
    expect(groupRows(rows, "department")).toHaveLength(1);
    expect(groupRows(rows, "department")[0].rows.map((a) => a.id)).toEqual([
      "named",
    ]);
    expect(
      compare(rows, { ...defaultConfig, level: "department" })[0].value,
    ).toBe(10);
  });
  it("uses equal university statistics consistently in heatmaps", () => {
    const rows = [
      make("a", 0),
      make("b", 0),
      make("c", 100, { universityId: "v" }),
    ];
    const c = {
      ...defaultConfig,
      level: "type" as const,
      weight: "equal" as const,
      chart: "heatmap" as const,
    };
    const option = comparisonChart(rows, c, [], []);
    const cell = option.series[0].data.find((p: any) => p.value[0] === 1);
    expect(cell.actual).toBe(50);
    expect(cell.n).toBe(3);
  });
  it("excludes missing bubble sizes while retaining explicit zero", () => {
    const rows = [
      make("missing", 10, { hIndex: null }),
      make("zero", 0),
      make("valid", 10),
    ];
    const option = comparisonChart(
      rows,
      { ...defaultConfig, chart: "bubble" },
      [],
      [],
    );
    expect(option.series[0].data.map((p: any) => p.academicId)).toEqual([
      "zero",
      "valid",
    ]);
  });
  it("omits zero pinned coordinates on log scales and preserves clickable identity", () => {
    const rows = [make("zero", 0), make("valid", 10)];
    const option = comparisonChart(
      rows,
      { ...defaultConfig, chart: "scatter", log: true },
      rows,
      [],
    );
    expect(option.series).toHaveLength(2);
    expect(option.series[1].data[0].academicId).toBe("valid");
  });
  it("does not invent an empty histogram and includes the maximum bin value", () => {
    expect(
      comparisonChart(
        [make("missing", null)],
        { ...defaultConfig, chart: "histogram" },
        [],
        [],
      ).series,
    ).toHaveLength(0);
    const rows = [make("a", 0.1), make("b", 0.8), make("c", 19.7)];
    const option = comparisonChart(
      rows,
      { ...defaultConfig, chart: "histogram" },
      [],
      [],
    );
    expect(
      option.series[0].data.reduce((n: number, v: number[]) => n + v[1], 0),
    ).toBe(3);
  });
  it("clears hidden log modes and unsupported distribution aggregation", () => {
    useAtlas.getState().configure({ chart: "scatter", log: true });
    useAtlas.getState().configure({ chart: "box" });
    expect(useAtlas.getState().config.log).toBe(false);
    useAtlas.getState().configure({ aggregation: "distribution" });
    useAtlas.getState().configure({ chart: "treemap" });
    expect(useAtlas.getState().config.aggregation).toBe("median");
  });
  it("removes deleted custom groups from the selection", () => {
    useAtlas.setState({
      custom: [{ id: "one", name: "One", ids: ["a"] }],
      config: { ...defaultConfig, groups: ["one"] },
    });
    useAtlas.getState().deleteGroup("one");
    expect(useAtlas.getState().config.groups).toEqual([]);
  });
});
