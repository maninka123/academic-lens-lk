import Papa from "papaparse";
import type { Academic } from "../types";
import type { StandingScore } from "../analytics/standing-score";

const guard = (v: unknown) =>
  typeof v === "string" && /^[=+@\-\t\r]/.test(v)
    ? "'" + v
    : v && typeof v === "object"
      ? JSON.stringify(v)
      : (v ?? "");

/** One row: the public record plus the research standing score and its working. */
export function personCsv(person: Academic, score: StandingScore, generated: string) {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(person))
    if (!["researchObservations", "researchIdentities", "metricEvidence"].includes(k))
      row[k] = guard(v);
  row.standing_score_percent = score.score ?? "";
  row.standing_band = score.band ?? "";
  row.standing_basis = score.basis;
  row.standing_confidence = score.confidence ?? "";
  row.standing_peer_group = score.groupLabel;
  row.standing_peer_group_size = score.groupSize || "";
  row.standing_measures_used = score.measuresUsed;
  row.standing_caveats = score.caveats.join(" | ");
  row.standing_not_scored_reason = score.reason;
  for (const c of score.components) {
    row[`standing_${c.metric}_value`] = c.value ?? "";
    row[`standing_${c.metric}_source`] = c.provider;
    row[`standing_${c.metric}_peers`] = c.status === "missing" ? "" : c.peers;
    row[`standing_${c.metric}_percentile`] = c.percentile === null ? "" : Math.round(c.percentile * 10) / 10;
    row[`standing_${c.metric}_weight`] = c.weight;
    row[`standing_${c.metric}_status`] = c.status;
  }
  row.report_generated = generated;
  return "﻿" + Papa.unparse([row]);
}
