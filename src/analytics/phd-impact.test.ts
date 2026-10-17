import { expect, it } from "vitest";
import { groupStats, qsBandOf, qsNumber, seniorityBand } from "./phd-impact";
import type { Academic } from "../types";

it("reads QS positions from their published text", () => {
  expect(qsNumber("=22")).toBe(22);
  expect(qsNumber("1001-1200")).toBe(1001);
  expect(qsNumber("1401+")).toBe(1401);
  expect(qsNumber("")).toBeNull();
});

it("bands the QS rank and leaves unlocated ranks out", () => {
  expect(qsBandOf({ phdQsRank: "=22", phdQsStatus: "ranked" })).toBe("Top 100");
  expect(qsBandOf({ phdQsRank: "150", phdQsStatus: "ranked" })).toBe("101–250");
  expect(qsBandOf({ phdQsRank: "761-770", phdQsStatus: "ranked" })).toBe("501–1000");
  expect(qsBandOf({ phdQsRank: "1401+", phdQsStatus: "ranked" })).toBe("1001+");
  expect(qsBandOf({ phdQsRank: "", phdQsStatus: "not_ranked" })).toBe("Not ranked");
  expect(qsBandOf({ phdQsRank: "", phdQsStatus: "not_located" })).toBeNull();
});

it("groups positions by seniority", () => {
  expect(seniorityBand("Senior Professor")).toBe("Professor");
  expect(seniorityBand("Associate Professor")).toBe("Senior Lecturer");
  expect(seniorityBand("Assistant Professor")).toBe("Lecturer");
  expect(seniorityBand("Unknown")).toBeNull();
});

it("computes the chosen statistic, flags small groups and counts the position mix", () => {
  const mk = (h: number | null, rank: string, g: string) => ({ hIndex: h, rank, g }) as unknown as Academic & { g: string };
  const rows = [mk(2, "Lecturer", "A"), mk(4, "Senior Lecturer", "A"), mk(10, "Professor", "A"), mk(null, "Professor", "A"), mk(7, "Lecturer", "B")];
  const [a, b] = groupStats(rows, (r) => (r as any).g, "hIndex", "median", 3);
  expect(a.label).toBe("A");
  expect(a.value).toBe(4);
  expect(a.n).toBe(3);
  expect(a.people).toBe(4);
  expect(a.lowN).toBe(false);
  expect(a.mix).toEqual({ Lecturer: 1, "Senior Lecturer": 1, Professor: 2 });
  expect(b.lowN).toBe(true);
  expect(groupStats(rows, (r) => (r as any).g, "hIndex", "mean", 3)[0].value).toBeCloseTo(16 / 3, 5);
});
