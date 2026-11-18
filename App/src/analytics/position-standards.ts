import type { Academic, NumericMetric, Provider } from "../types";
import { summary, values } from "./engine";
import { SENIOR_LECTURER_GROUP, equivalentPosition, withProvider } from "./quality";

/** Seniority groups shown in position standards (unknown or unclassified positions are left out). */
export const POSITION_ORDER = [
  "Senior Professor",
  "Professor",
  SENIOR_LECTURER_GROUP,
  "Assistant Professor",
  "Lecturer",
  "Assistant Lecturer",
] as const;
export const STANDARD_METRICS: { key: NumericMetric; label: string }[] = [
  { key: "hIndex", label: "h-index" },
  { key: "citations", label: "Citations" },
  { key: "recentCitations", label: "Citations 2021–2025" },
  { key: "publications", label: "Publications" },
];
export type PositionRow = {
  position: string;
  people: number;
  n: number;
  median: number | null;
  mean: number | null;
  q1: number | null;
  q3: number | null;
};

/** Per-position summary of one metric. One provider only; missing is never zero. */
export function positionStandards(
  rows: Academic[],
  metric: NumericMetric,
  provider: Provider = "Google Scholar",
): PositionRow[] {
  const scoped = withProvider(rows, provider).rows;
  return POSITION_ORDER.map((position) => {
    const inGroup = scoped.filter((a) => equivalentPosition(a.rank) === position);
    const v = values(inGroup.map((a) => a[metric]));
    const s = summary(v);
    return {
      position,
      people: rows.filter((a) => equivalentPosition(a.rank) === position).length,
      n: v.length,
      median: v.length ? s.median : null,
      mean: v.length ? s.mean : null,
      q1: v.length ? s.q1 : null,
      q3: v.length ? s.q3 : null,
    };
  }).filter((r) => r.people > 0);
}
