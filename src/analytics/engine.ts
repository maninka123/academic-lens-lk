import type {
  Academic,
  Aggregation,
  Config,
  CustomGroup,
  Filters,
  Level,
  Metric,
  NumericMetric,
} from "../types";
export const values = (v: (number | null | undefined)[]) =>
  v.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
export const sum = (v: number[]) => v.reduce((s, n) => s + n, 0);
export const mean = (v: number[]) => (v.length ? sum(v) / v.length : null);
export function quantile(v: number[], p: number) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b),
    i = (s.length - 1) * p,
    lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}
export const median = (v: number[]) => quantile(v, 0.5);
export function summary(v: number[]) {
  const m = mean(v);
  return {
    n: v.length,
    total: v.length ? sum(v) : null,
    mean: m,
    median: median(v),
    q1: quantile(v, 0.25),
    q3: quantile(v, 0.75),
    min: v.length ? Math.min(...v) : null,
    max: v.length ? Math.max(...v) : null,
    sd:
      m === null ? null : Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / v.length),
    iqr: v.length ? quantile(v, 0.75)! - quantile(v, 0.25)! : null,
  };
}
export function percentile(v: number[], x: number | null) {
  return x === null || v.length < 5
    ? null
    : (100 *
        (v.filter((n) => n < x).length +
          0.5 * v.filter((n) => n === x).length)) /
        v.length;
}
export const proportion = (numerator: number, denominator: number) =>
  denominator ? (100 * numerator) / denominator : null;
export const validModes = (metric: Metric): Aggregation[] =>
  ["phd", "overseas"].includes(metric)
    ? ["percentage"]
    : metric === "count"
      ? ["total"]
      : ["hIndex", "phdYear", "experience"].includes(metric)
        ? ["median", "mean", "distribution"]
        : ["median", "mean", "total", "per10", "distribution"];
export function aggregate(rows: Academic[], metric: Metric, mode: Aggregation) {
  if (metric === "count")
    return { value: rows.length, n: rows.length, total: rows.length };
  if (metric === "phd") {
    const known = rows.filter((a) => a.qualification !== "Unknown");
    return {
      value: proportion(
        known.filter((a) => a.qualification === "PhD").length,
        known.length,
      ),
      n: known.length,
      total: rows.length,
    };
  }
  if (metric === "overseas") {
    const known = rows.filter((a) => a.phdCountry && a.qualification === "PhD");
    return {
      value: proportion(
        known.filter((a) => a.phdCountry !== "Sri Lanka").length,
        known.length,
      ),
      n: known.length,
      total: rows.length,
    };
  }
  const v = values(rows.map((a) => a[metric]));
  const s = summary(v);
  return {
    value:
      mode === "total"
        ? s.total
        : mode === "mean"
          ? s.mean
          : mode === "per10"
            ? s.mean === null
              ? null
              : s.mean * 10
            : s.median,
    n: v.length,
    total: rows.length,
  };
}
export function filterAcademics(rows: Academic[], f: Filters) {
  const has = (list: string[], v: string) => !list.length || list.includes(v);
  const range = (v: number | null, r: [number | null, number | null]) =>
    r.every((x) => x === null) ||
    (v !== null &&
      (r[0] === null || v >= r[0]) &&
      (r[1] === null || v <= r[1]));
  return rows.filter(
    (a) =>
      has(f.types, a.type) &&
      has(f.universities, a.universityId) &&
      has(f.faculties, a.facultyId) &&
      has(f.departments, a.departmentId) &&
      has(f.ranks, a.rank) &&
      has(f.qualifications, a.qualification) &&
      has(f.countries, a.phdCountry || "Unknown") &&
      has(f.fields, a.field) &&
      [a.name, a.university, a.department, a.faculty]
        .join(" ")
        .toLowerCase()
        .includes(f.query.toLowerCase()) &&
      a.interests.toLowerCase().includes(f.interest.toLowerCase()) &&
      range(a.experience, f.experience) &&
      range(a.phdYear, f.phdYear) &&
      range(a.citations, f.citations) &&
      range(a.publications, f.publications),
  );
}
export function groupKey(a: Academic, level: Level) {
  switch (level) {
    case "type":
      return a.type;
    case "university":
      return a.universityId;
    case "faculty":
      return a.facultyId || `${a.universityId}--unknown-faculty`;
    case "department":
      return a.departmentId || `${a.universityId}--unknown-department`;
    case "field":
      return a.field;
    case "rank":
      return a.rank;
    case "qualification":
      return a.qualification;
    case "phdCountry":
      return a.phdCountry || "Unknown";
    case "experience":
      return a.experience === null
        ? "Unknown"
        : a.experience < 5
          ? "0–4 years"
          : a.experience < 15
            ? "5–14 years"
            : a.experience < 25
              ? "15–24 years"
              : "25+ years";
    default:
      return "";
  }
}
export function groupLabel(a: Academic, l: Level) {
  return l === "university"
    ? a.university
    : l === "faculty"
      ? `${a.faculty || "Faculty unavailable"} · ${a.university}`
      : l === "department"
        ? `${a.department || "Department unavailable"} · ${a.university}`
        : groupKey(a, l);
}
export function groupRows(
  rows: Academic[],
  level: Level,
  custom: CustomGroup[] = [],
) {
  const map = new Map<
    string,
    { id: string; label: string; rows: Academic[] }
  >();
  if (level === "custom")
    return custom.map((g) => ({
      id: g.id,
      label: g.name,
      rows: rows.filter((a) => g.ids.includes(a.id)),
    }));
  for (const a of rows) {
    const key = groupKey(a, level);
    if (!map.has(key))
      map.set(key, { id: key, label: groupLabel(a, level), rows: [] });
    map.get(key)!.rows.push(a);
  }
  return [...map.values()];
}
export function compare(
  rows: Academic[],
  c: Config,
  custom: CustomGroup[] = [],
) {
  return groupRows(rows, c.level, custom)
    .filter((g) => !c.groups.length || c.groups.includes(g.id))
    .map((g) => {
      let stats = aggregate(g.rows, c.metric, c.aggregation);
      let universityN: number | undefined;
      if (c.level === "type" && c.weight === "equal") {
        const units = groupRows(g.rows, "university").map((u) =>
          aggregate(u.rows, c.metric, c.aggregation),
        );
        const v = values(units.map((u) => u.value));
        stats = { ...stats, value: mean(v) };
        universityN = v.length;
      }
      return {
        ...g,
        ...stats,
        universityN,
        distribution: ["count", "phd", "overseas"].includes(c.metric)
          ? []
          : values(g.rows.map((a) => a[c.metric as NumericMetric])),
      };
    })
    .sort((a, b) =>
      c.sort === "value"
        ? (b.value ?? -Infinity) - (a.value ?? -Infinity) ||
          a.label.localeCompare(b.label)
        : a.label.localeCompare(b.label),
    );
}
export function peers(rows: Academic[], a: Academic, kind: string) {
  switch (kind) {
    case "department":
      return a.departmentId
        ? rows.filter(
            (r) =>
              r.universityId === a.universityId &&
              r.facultyId === a.facultyId &&
              r.departmentId === a.departmentId,
          )
        : [];
    case "faculty":
      return a.facultyId
        ? rows.filter(
            (r) =>
              r.universityId === a.universityId && r.facultyId === a.facultyId,
          )
        : [];
    case "university":
      return rows.filter((r) => r.universityId === a.universityId);
    case "rank":
      return rows.filter((r) => r.rank === a.rank);
    case "field":
      return a.field === "Unmapped"
        ? []
        : rows.filter((r) => r.field === a.field);
    case "country":
      return a.phdCountry
        ? rows.filter((r) => r.phdCountry === a.phdCountry)
        : [];
    case "experience":
      return a.experience === null
        ? []
        : rows.filter(
            (r) =>
              r.experience !== null &&
              Math.abs(r.experience - a.experience!) <= 5,
          );
    case "Public":
    case "Non-state":
      return rows.filter((r) => r.type === kind);
    default:
      return rows;
  }
}
export const completeness = (rows: Academic[], field: keyof Academic) =>
  proportion(
    rows.filter(
      (a) => a[field] !== null && a[field] !== "" && a[field] !== "Unknown",
    ).length,
    rows.length,
  );
