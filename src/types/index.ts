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
};
export type Metric = keyof typeof metricLabels;
/** Measurements available in the app; retain legacy fields for source history. */
export const selectableMetricLabels = Object.fromEntries(
  Object.entries(metricLabels).filter(
    ([key]) => !["experience", "phdYear"].includes(key),
  ),
);
export const isSelectableMetric = (key: string) =>
  Object.hasOwn(selectableMetricLabels, key);
export type NumericMetric = Exclude<Metric, "count" | "phd" | "overseas">;
export type DoctorateStatus =
  "completed_documented" | "in_progress" | "contradictory" | "unknown";
export type Provider =
  | "Google Scholar"
  | "ResearchGate"
  | "OpenAlex"
  | "Mixed"
  | "Other"
  | "Not recorded";
export type ResearchEvidenceLevel =
  "confirmed" | "corroborated" | "possible" | "unresolved";
export type ResearchEvidenceMode = "confirmed" | "expanded" | "exploratory";
export type ResearchObservation = {
  metric: string;
  value: number;
  provider: Provider;
  url: string;
  date: string;
  identityStatus: ResearchEvidenceLevel;
};
export type Academic = {
  id: string;
  name: string;
  sourceName?: string;
  country?: string;
  doctorateStatus?: DoctorateStatus;
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
  /** Country inferred from the awarding institution's name, not published. */
  phdCountryInferred?: boolean;
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
  openAlexStatus?: string;
  openAlexUrl?: string;
  openAlexMatchLevel?: ResearchEvidenceLevel;
  researchIdentities?: {
    provider: Provider;
    status: ResearchEvidenceLevel;
    url: string;
    method: string;
    date: string;
  }[];
  researchObservations?: ResearchObservation[];
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
  /** Optional maintainer caution about reading this person's metrics. */
  caution?: string;
};
export type University = {
  id: string;
  name: string;
  short: string;
  type: "Public" | "Non-state";
  country?: string;
};
/** Per-institution coverage indicators published by the importer. */
export type Coverage = {
  university_id: string;
  university: string;
  type: string;
  academic_records: number;
  verified_identity: number;
  verified_employment: number;
  with_any_metric: number;
  with_qualifications: number;
  doctorate_documented: number;
  doctorate_in_progress: number;
  doctorate_contradictory: number;
  needs_review: number;
  faculties_represented: number;
  departments_represented: number;
  units_discovered: number;
  units_visited: number;
  roster_status: string;
};
export type DatasetSummary = {
  version: string;
  collectionDate: string;
  institutionsInScope: number;
  institutionsWithProfiles: number;
  facultiesRepresented: number;
  departmentsRepresented: number;
  academicRecords: number;
  verifiedIdentity: number;
  verifiedEmployment: number;
  withAnyMetric: number;
  withQualifications: number;
  doctorateDocumented: number;
  doctorateInProgress: number;
  doctorateContradictory: number;
  needsReview: number;
  metricAvailability: Record<string, number>;
  internationalBenchmarks: {
    universities: number;
    academics: number;
    countries: number;
  };
};
export type Metadata = {
  updatedAt?: string;
  identityAliases?: Record<string, string>;
  evidenceFiles?: string[];
  version: string;
  mode: "real" | "demo";
  collectionDate: string;
  window: [number, number];
  description: string;
  q1Methodology?: string;
  limitations: string[];
  scopeNote: string;
  minimumSample?: number;
  correctionContact?: string;
  country?: string;
};
export type Dataset = {
  academics: Academic[];
  universities: University[];
  metadata: Metadata;
  coverage: Coverage[];
  summary: DatasetSummary | null;
};
export type Level =
  | "type"
  | "university"
  | "faculty"
  | "department"
  | "field"
  | "rank"
  | "careerStage"
  | "qualification"
  | "phdCountry"
  | "experience"
  | "custom";
export const levelLabels: Record<Level, string> = {
  type: "Public vs Non-state",
  university: "Universities",
  faculty: "Faculties (each university’s own)",
  department: "Departments (each university’s own)",
  field: "Broad disciplines (matched across universities)",
  rank: "Academic positions",
  careerStage: "Career stage (approximate, cross-system)",
  qualification: "Qualifications",
  phdCountry: "PhD countries",
  experience: "Experience groups",
  custom: "Custom academic groups",
};
/** Plural noun for the groups picker, matching the chosen comparison level. */
export const levelGroupNouns: Record<Level, string> = {
  type: "Sectors",
  university: "Universities",
  faculty: "Faculties",
  department: "Departments",
  field: "Disciplines",
  rank: "Positions",
  careerStage: "Career stages",
  qualification: "Qualifications",
  phdCountry: "PhD countries",
  experience: "Experience groups",
  custom: "Custom groups",
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
  /** "single" restricts metric values to one provider; "mixed" is exploratory. */
  providerMode?: "single" | "mixed";
  provider?: Provider;
};
