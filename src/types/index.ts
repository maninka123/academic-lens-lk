export const metricLabels = {
  count: "Academic records",
  phd: "Recorded PhD percentage",
  overseas: "Recorded overseas PhD percentage",
  experience: "Academic experience",
  phdYear: "PhD completion year",
  publications: "Publications",
  citations: "Citations",
  recentCitations: "Five-year citations",
  hIndex: "h-index",
  q1: "Q1 publications",
  recentQ1: "Five-year Q1 publications",
};
export type Metric = keyof typeof metricLabels;
export type NumericMetric = Exclude<Metric, "count" | "phd" | "overseas">;
export type Academic = {
  id: string;
  name: string;
  sourceName?: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
  university: string;
  faculty: string;
  department: string;
  type: "Public" | "Non-state";
  position: string;
  rank: string;
  qualifications: string;
  qualification: string;
  phdUniversity: string;
  phdCountry: string;
  phdYear: number | null;
  phdStatus: string;
  experience: number | null;
  interests: string;
  publications: number | null;
  citations: number | null;
  recentCitations: number | null;
  hIndex: number | null;
  q1: number | null;
  recentQ1: number | null;
  sourceUrl: string;
  scholarUrl: string;
  researchgateUrl?: string;
  scholarStatus?: string;
  researchgateStatus?: string;
  qualificationReview?: string;
  metricEvidence?: {
    metric: string;
    value: number;
    source: string;
    url: string;
    date: string;
    note: string;
  }[];
  metricsUrl: string;
  metricsSource: string;
  collectionDate: string;
  snapshotDate: string;
  status: string;
  employmentStatus: string;
  field: string;
  notes: string;
};
export type University = {
  id: string;
  name: string;
  short: string;
  type: "Public" | "Non-state";
};
export type Metadata = {
  identityAliases?: Record<string, string>;
  evidenceFiles?: string[];
  version: string;
  mode: "real" | "demo";
  collectionDate: string;
  window: [number, number];
  description: string;
  q1Methodology: string;
  limitations: string[];
  scopeNote: string;
};
export type Dataset = {
  academics: Academic[];
  universities: University[];
  metadata: Metadata;
};
export type Level =
  | "type"
  | "university"
  | "faculty"
  | "department"
  | "field"
  | "rank"
  | "qualification"
  | "phdCountry"
  | "experience"
  | "custom";
export const levelLabels: Record<Level, string> = {
  type: "Public vs Non-state",
  university: "Universities",
  faculty: "Actual faculties",
  department: "Departments",
  field: "Standardised fields",
  rank: "Academic positions",
  qualification: "Qualifications",
  phdCountry: "PhD countries",
  experience: "Experience groups",
  custom: "Custom academic groups",
};
export type Aggregation =
  "median" | "mean" | "total" | "per10" | "distribution" | "percentage";
export type ChartType =
  | "bar"
  | "grouped"
  | "stacked"
  | "percentStacked"
  | "scatter"
  | "bubble"
  | "box"
  | "histogram"
  | "heatmap"
  | "treemap";
export type Filters = {
  types: string[];
  universities: string[];
  faculties: string[];
  departments: string[];
  ranks: string[];
  qualifications: string[];
  countries: string[];
  fields: string[];
  query: string;
  interest: string;
  experience: [number | null, number | null];
  phdYear: [number | null, number | null];
  citations: [number | null, number | null];
  publications: [number | null, number | null];
};
export type CustomGroup = { id: string; name: string; ids: string[] };
export type Config = {
  level: Level;
  metric: Metric;
  aggregation: Aggregation;
  chart: ChartType;
  weight: "pooled" | "equal";
  groups: string[];
  peer: string;
  xMetric: NumericMetric;
  log: boolean;
  labels: boolean;
  sort: "name" | "value";
  benchmarks?: boolean;
};
