import type { Academic, NumericMetric } from "../types";
import { summary } from "./engine";
import { equivalentPosition } from "./quality";

/** Numeric QS position from the published text: "=22" -> 22, "1001-1200" -> 1001, "1401+" -> 1401. */
export function qsNumber(rank: string | null | undefined): number | null {
  const m = String(rank ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

export const QS_BANDS = ["Top 100", "101–250", "251–500", "501–1000", "1001+", "Not ranked"] as const;
export type QsBand = (typeof QS_BANDS)[number];

/** QS 2027 band of the university that awarded the doctorate; null when the rank was not located. */
export function qsBandOf(a: Pick<Academic, "phdQsRank" | "phdQsStatus">): QsBand | null {
  if (a.phdQsStatus === "not_ranked") return "Not ranked";
  if (a.phdQsStatus !== "ranked") return null;
  const n = qsNumber(a.phdQsRank);
  if (n === null) return null;
  return n <= 100 ? "Top 100" : n <= 250 ? "101–250" : n <= 500 ? "251–500" : n <= 1000 ? "501–1000" : "1001+";
}

export const SENIORITY = ["Lecturer", "Senior Lecturer", "Professor"] as const;
export type Seniority = (typeof SENIORITY)[number];

/** Seniority band used when comparing people: a Lecturer sits with an Assistant Professor elsewhere. */
export function seniorityBand(rank: string): Seniority | null {
  if (rank === "Professor" || rank === "Senior Professor") return "Professor";
  if (equivalentPosition(rank) === "Senior Lecturer") return "Senior Lecturer";
  if (["Lecturer", "Assistant Lecturer", "Assistant Professor"].includes(rank)) return "Lecturer";
  return null;
}

export type Statistic = "median" | "mean";

export type GroupStat = {
  label: string;
  /** People in the group (with a seniority band when filtered). */
  people: number;
  /** People with a value for the measure. */
  n: number;
  value: number | null;
  median: number | null;
  mean: number | null;
  q1: number | null;
  q3: number | null;
  /** Fewer valid values than the minimum sample: shown, but flagged as indicative. */
  lowN: boolean;
  mix: Record<Seniority, number>;
};

/** Statistic of one measure for each group; groups keep first-seen order unless sorted by the caller. */
export function groupStats(
  rows: Academic[],
  key: (a: Academic) => string | null,
  metric: NumericMetric,
  statistic: Statistic,
  minN: number,
): GroupStat[] {
  const map = new Map<string, Academic[]>();
  for (const a of rows) {
    const k = key(a);
    if (k === null || k === "") continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(a);
  }
  return [...map].map(([label, members]) => {
    const vals = members
      .map((a) => a[metric])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const s = summary(vals);
    const mix = { Lecturer: 0, "Senior Lecturer": 0, Professor: 0 } as Record<Seniority, number>;
    for (const a of members) {
      const b = seniorityBand(a.rank);
      if (b) mix[b] += 1;
    }
    return {
      label,
      people: members.length,
      n: vals.length,
      value: vals.length ? (statistic === "median" ? s.median : s.mean) : null,
      median: s.median,
      mean: s.mean,
      q1: s.q1,
      q3: s.q3,
      lowN: vals.length < minN,
      mix,
    };
  });
}
