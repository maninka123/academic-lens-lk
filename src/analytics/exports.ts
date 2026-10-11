// Reproducible exports: every aggregate table carries the selection, metric
// definition, provider, counts and dataset version that produced it.
import Papa from "papaparse";
import { download } from "../components/common";

export type ExportContext = {
  title: string;
  population: string;
  filters: Record<string, string>;
  metric: string;
  metricDefinition: string;
  provider: string;
  aggregation: string;
  datasetVersion: string;
  window: string;
  minimumSample: number;
  notes?: string[];
};
export type ExportRow = {
  group: string;
  value: number | null;
  valid: number;
  eligible: number;
  providers?: string;
  measured?: string;
  flag?: string;
};

/** CSV text: a "# key: value" metadata block, a blank line, then the table. */
export function statisticsCsv(ctx: ExportContext, rows: ExportRow[]) {
  const meta: [string, string][] = [
    ["Export", ctx.title],
    ["Exported at", new Date().toISOString()],
    ["Dataset version", ctx.datasetVersion],
    ["Population", ctx.population],
    ...Object.entries(ctx.filters).map(
      ([k, v]) => ["Filter: " + k, v || "all"] as [string, string],
    ),
    ["Metric", ctx.metric],
    ["Metric definition", ctx.metricDefinition],
    ["Metric provider", ctx.provider],
    ["Aggregation", ctx.aggregation],
    ["Measurement window", ctx.window],
    ["Minimum sample for ranking", String(ctx.minimumSample)],
    ...(ctx.notes || []).map((n) => ["Note", n] as [string, string]),
  ];
  const table = Papa.unparse(
    rows.map((r) => ({
      group: r.group,
      value: r.value ?? "",
      valid_observations: r.valid,
      missing_observations: r.eligible - r.valid,
      eligible_records: r.eligible,
      completeness_pct: r.eligible
        ? Math.round((1000 * r.valid) / r.eligible) / 10
        : "",
      providers: r.providers || "",
      measured: r.measured || "",
      flag: r.flag || "",
    })),
  );
  const head = meta
    .map(([k, v]) => "# " + k + ": " + String(v).replace(/\r?\n/g, " "))
    .join("\n");
  return head + "\n\n" + table;
}

export function exportStatistics(
  ctx: ExportContext,
  rows: ExportRow[],
  name = "academic-atlas-statistics.csv",
) {
  download(name, "﻿" + statisticsCsv(ctx, rows));
}

export const metricDefinitions: Record<string, string> = {
  count:
    "Number of collected academic records in the group (not a staff census).",
  phd: "Records with a documented completed doctorate ÷ records with documented qualifications.",
  overseas:
    "Documented doctorates awarded outside Sri Lanka ÷ documented doctorates with a known awarding country.",
  experience: "Source-reported academic experience in years.",
  phdYear: "Year of doctoral completion stated in the qualification evidence.",
  publications: "Career publication count reported by the provider.",
  citations: "All-time citation count reported by the provider.",
  recentCitations:
    "Citations received in the measurement window (all annual values verified).",
  hIndex:
    "Individual h-index reported by the provider; never summed across people.",
  q1: "Journal articles in Q1 journals (publication-year quartiles).",
  recentQ1: "Q1 journal articles published in the measurement window.",
};
