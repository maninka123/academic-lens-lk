import { describe, it, expect } from "vitest";
import { splitFacultyUnits } from "./org-units";
import type { OrgUnit } from "../types";

const registry: OrgUnit[] = [
  { id: "colombo--university-of-colombo-school-of-computing-ucsc", universityId: "colombo", name: "University of Colombo School of Computing (UCSC)", category: "campus_school" },
  { id: "colombo--sri-palee-campus-spc", universityId: "colombo", name: "Sri Palee Campus (SPC)", category: "campus_school" },
];
const g = (id: string, rows: number[] = [1]) => ({ id, label: id, rows });

describe("Campuses & Schools", () => {
  it("lists registered units without staff, with no invented records", () => {
    const { faculties, campuses } = splitFacultyUnits([g("colombo--faculty-of-arts")], registry, "colombo");
    expect(faculties.map((x) => x.id)).toEqual(["colombo--faculty-of-arts"]);
    expect(campuses.map((x) => x.label)).toEqual(["University of Colombo School of Computing (UCSC)", "Sri Palee Campus (SPC)"]);
    expect(campuses.every((x) => x.rows.length === 0)).toBe(true);
  });
  it("moves a registered unit out of the faculties once it has staff", () => {
    const { faculties, campuses } = splitFacultyUnits(
      [g("colombo--faculty-of-arts"), g("colombo--university-of-colombo-school-of-computing-ucsc", [1, 2, 3])],
      registry,
      "colombo",
    );
    expect(faculties).toHaveLength(1);
    expect(campuses.find((x) => x.id.endsWith("ucsc"))?.rows).toHaveLength(3);
    expect(campuses).toHaveLength(2);
  });
  it("leaves other universities untouched", () => {
    const { faculties, campuses } = splitFacultyUnits([g("moratuwa--faculty-of-engineering")], registry, "moratuwa");
    expect(faculties).toHaveLength(1);
    expect(campuses).toEqual([]);
  });
});
