import type { Academic, University } from "../types";
import { aggregate, median, values } from "./engine";
import { MIN_SAMPLE } from "./quality";

export type UniversityStats = University & {
  profiles: number;
  share: number;
  faculties: number;
  departments: number;
  /** Percentage of profiles with a documented PhD among known qualifications. */
  phd: number | null;
  phdKnown: number;
  /** Percentage of documented PhDs awarded outside Sri Lanka. */
  overseas: number | null;
  overseasKnown: number;
  seniorShare: number | null;
  medianCitations: number | null;
  citationsN: number;
  medianH: number | null;
  hN: number;
  medianPublications: number | null;
  withMetric: number | null;
};

/** One row of headline facts per institution; thin samples are kept but flagged by callers. */
export function universityStats(
  academics: Academic[],
  universities: University[],
): UniversityStats[] {
  return universities.map((u) => {
    const rows = academics.filter((a) => a.universityId === u.id);
    const phd = aggregate(rows, "phd", "percentage");
    const overseas = aggregate(rows, "overseas", "percentage");
    const cites = values(rows.map((a) => a.citations));
    const h = values(rows.map((a) => a.hIndex));
    const pubs = values(rows.map((a) => a.publications));
    const senior = rows.filter((a) =>
      ["Senior Professor", "Professor", "Associate Professor"].includes(a.rank),
    ).length;
    const any = rows.filter(
      (a) => a.citations !== null || a.hIndex !== null || a.publications !== null,
    ).length;
    return {
      ...u,
      profiles: rows.length,
      share: academics.length ? (100 * rows.length) / academics.length : 0,
      faculties: new Set(rows.map((a) => a.facultyId).filter(Boolean)).size,
      departments: new Set(rows.map((a) => a.departmentId).filter(Boolean)).size,
      phd: phd.value,
      phdKnown: phd.n,
      overseas: overseas.value,
      overseasKnown: overseas.n,
      seniorShare: rows.length ? (100 * senior) / rows.length : null,
      medianCitations: median(cites),
      citationsN: cites.length,
      medianH: median(h),
      hN: h.length,
      medianPublications: median(pubs),
      withMetric: rows.length ? (100 * any) / rows.length : null,
    };
  });
}

/** Best institution on a metric among those with enough valid observations. */
export function leader(
  stats: UniversityStats[],
  value: (s: UniversityStats) => number | null,
  n: (s: UniversityStats) => number,
  min = MIN_SAMPLE,
) {
  return stats
    .filter((s) => value(s) !== null && n(s) >= min)
    .sort((a, b) => value(b)! - value(a)!)[0];
}
