// Research standing score: a transparent 0–100 blend of percentile ranks.
// Rules (see docs/STANDING_SCORE.md): compare like with like, never treat
// missing as zero, one provider per measure, and say how sure we are.
import type { Academic, NumericMetric } from "../types";
import { MIN_SAMPLE, careerStageOf, providerOf } from "./quality";

export const SCORE_MEASURES = [
  { metric: "hIndex", label: "h-index", short: "h-index", weight: 0.4, impact: true },
  { metric: "recentCitations", label: "Citations 2021–2025", short: "Recent citations", weight: 0.35, impact: true },
  { metric: "publications", label: "Publications", short: "Publications", weight: 0.25, impact: false },
] as const satisfies readonly {
  metric: NumericMetric;
  label: string;
  short: string;
  weight: number;
  impact: boolean;
}[];

export const SCORE_BANDS = [
  { min: 80, label: "High for their group" },
  { min: 60, label: "Above typical" },
  { min: 40, label: "Typical" },
  { min: 20, label: "Below typical" },
  { min: 0, label: "Low for their group" },
] as const;
export const bandOf = (score: number) =>
  SCORE_BANDS.find((b) => score >= b.min)!.label;

export type ComponentStatus = "scored" | "missing" | "few-peers";
export type ScoreComponent = {
  metric: NumericMetric;
  label: string;
  short: string;
  weight: number;
  value: number | null;
  provider: string;
  status: ComponentStatus;
  /** Peers (including the person) with a value from the same provider. */
  peers: number;
  percentile: number | null;
  note: string;
};
export type Confidence = "high" | "medium" | "low";
export type StandingScore = {
  score: number | null;
  band: string | null;
  confidence: Confidence | null;
  /** "standard" = normal rules met; "indicative" = a fallback was needed. */
  basis: "standard" | "indicative" | "none";
  /** What was relaxed to produce an indicative score; empty for standard. */
  caveats: string[];
  level: "discipline-stage" | "stage" | "discipline" | "everyone" | "none";
  stage: string;
  discipline: string;
  groupLabel: string;
  groupSize: number;
  components: ScoreComponent[];
  weightUsed: number;
  measuresUsed: number;
  verified: boolean;
  reason: string;
};

const unknownField = (f?: string) =>
  !f || /^(unmapped|unclassified|unknown)$/i.test(f.trim());
const VERIFIED = ["verified_official_link", "matched_user_supplied_platform_evidence"];
const isVerified = (a: Academic) =>
  VERIFIED.includes(a.scholarStatus || "") ||
  VERIFIED.includes(a.researchgateStatus || "") ||
  Boolean(a.openAlexUrl);

/** Midrank percentile: (below + ½ ties) ÷ n × 100. */
const midrank = (pool: number[], x: number) =>
  (100 * (pool.filter((v) => v < x).length + 0.5 * pool.filter((v) => v === x).length)) /
  pool.length;

function evaluate(person: Academic, members: Academic[], min: number, sameProvider: boolean) {
  return SCORE_MEASURES.map((m): ScoreComponent => {
    const value = person[m.metric];
    const base = { metric: m.metric, label: m.label, short: m.short, weight: m.weight };
    if (value === null || value === undefined || !Number.isFinite(value))
      return { ...base, value: null, provider: "Not recorded", status: "missing", peers: 0, percentile: null, note: "No value recorded; skipped, not counted as zero." };
    const provider = providerOf(person, m.metric);
    const pool = members
      .filter((p) => p[m.metric] !== null && (!sameProvider || providerOf(p, m.metric) === provider))
      .map((p) => p[m.metric] as number);
    if (pool.length < min)
      return { ...base, value, provider, status: "few-peers", peers: pool.length, percentile: null, note: `Only ${pool.length} ${pool.length === 1 ? "person has" : "people have"} a${sameProvider ? " " + provider : ""} value (needs ${min}); skipped.` };
    return { ...base, value, provider, status: "scored", peers: pool.length, percentile: midrank(pool, value), note: "" };
  });
}

const blank = (reason: string, extra: Partial<StandingScore> = {}): StandingScore => ({
  score: null, band: null, confidence: null, basis: "none", caveats: [], level: "none",
  stage: "", discipline: "", groupLabel: "", groupSize: 0, components: [],
  weightUsed: 0, measuresUsed: 0, verified: false, reason, ...extra,
});

/** Smaller peer groups are accepted only in the fallback pass. */
const RELAXED_MIN = 5;

/**
 * Score one person against everyone collected.
 *
 * Standard: same career stage x discipline (or stage alone), at least
 * `min` peers per measure from the same source, at least two measures with one
 * impact measure. If that fails, an *indicative* score is built by relaxing one
 * rule at a time, always telling the reader which rule was relaxed:
 *   1. one measure is enough, peer groups of 5+ are accepted;
 *   2. career stage unknown -> compare across all stages;
 *   3. peers from other sources are pooled (mixed sources).
 * With no research measure at all there is nothing to score.
 */
export function standingScore(
  person: Academic,
  everyone: Academic[],
  min: number = MIN_SAMPLE,
): StandingScore {
  const stage = careerStageOf(person.rank);
  const stageKnown = !["Teaching / other", "Unknown"].includes(stage);
  const field = unknownField(person.field) ? "" : person.field;
  const verified = isVerified(person);
  if (!SCORE_MEASURES.some((m) => person[m.metric] !== null && person[m.metric] !== undefined))
    return blank("Not scored: no h-index, citation or publication value is recorded, so there is nothing to compare.", { stage, discipline: field, verified });

  const sameStage = stageKnown ? everyone.filter((p) => careerStageOf(p.rank) === stage) : [];
  const sameField = field ? everyone.filter((p) => p.field === field) : [];
  type Level = { level: StandingScore["level"]; members: Academic[]; label: string; note?: string };
  const stagedLevels: Level[] = stageKnown
    ? [
        ...(field ? [{ level: "discipline-stage" as const, members: sameStage.filter((p) => p.field === field), label: `${stage} · ${field}` }] : []),
        { level: "stage" as const, members: sameStage, label: `All ${stage.toLowerCase()} academics` },
      ]
    : [];
  const unstagedLevels: Level[] = [
    ...(field ? [{ level: "discipline" as const, members: sameField, label: `${field} · all career stages`, note: "Career stage not recognised: compared with the whole discipline across all stages." }] : []),
    { level: "everyone" as const, members: everyone, label: "All collected academics", note: "Career stage and discipline not available: compared with everyone collected." },
  ];

  const finish = (lv: Level, components: ScoreComponent[], standard: boolean, caveats: string[]): StandingScore | null => {
    const scored = components.filter((c) => c.status === "scored");
    if (!scored.length) return null;
    const hasImpact = scored.some((c) => SCORE_MEASURES.find((m) => m.metric === c.metric)!.impact);
    if (standard && !(scored.length >= 2 && hasImpact)) return null;
    const weightUsed = scored.reduce((t, c) => t + c.weight, 0);
    const raw = scored.reduce((t, c) => t + c.weight * c.percentile!, 0) / weightUsed;
    const score = Math.round(raw);
    const notes = [...caveats];
    if (scored.length === 1) notes.push(`Only one measure (${scored[0].label}) is available.`);
    if (!hasImpact) notes.push("No impact measure (h-index or recent citations) is available.");
    let confidence: Confidence = "low";
    if (standard) {
      const smallest = Math.min(...scored.map((c) => c.peers));
      let points = 0;
      if (lv.level === "discipline-stage") points++;
      if (scored.length === SCORE_MEASURES.length) points++;
      if (smallest >= 25) points++;
      if (verified) points++;
      confidence = points >= 4 ? "high" : points >= 2 ? "medium" : "low";
      if (lv.level === "stage" && confidence === "high") confidence = "medium";
    }
    return {
      score, band: bandOf(score), confidence, basis: standard ? "standard" : "indicative",
      caveats: notes, level: lv.level, stage, discipline: field, groupLabel: lv.label,
      groupSize: lv.members.length, components, weightUsed, measuresUsed: scored.length,
      verified, reason: "",
    };
  };

  // Pass 0: the standard rules.
  for (const lv of stagedLevels) {
    const r = finish(lv, evaluate(person, lv.members, min, true), true, []);
    if (r) return r;
  }
  // Pass 1: accept one measure and peer groups of 5+.
  for (const lv of stagedLevels) {
    const r = finish(lv, evaluate(person, lv.members, RELAXED_MIN, true), false, [
      `Peer groups of ${RELAXED_MIN}+ accepted (normally ${min}+).`,
    ]);
    if (r) return r;
  }
  // Pass 2: career stage unknown.
  for (const lv of unstagedLevels) {
    const r = finish(lv, evaluate(person, lv.members, min, true), false, [lv.note!]);
    if (r) return r;
  }
  // Pass 3: pool peers from other sources.
  for (const lv of [...stagedLevels, ...unstagedLevels]) {
    const r = finish(lv, evaluate(person, lv.members, min, false), false, [
      ...(lv.note ? [lv.note] : []),
      "Peers from other sources are included, so values are not strictly like-for-like.",
    ]);
    if (r) return r;
  }
  const shown = evaluate(person, (stagedLevels.at(-1) || unstagedLevels.at(-1)!).members, min, true);
  return blank("Not scored: there are not enough peers with a comparable value to rank this person.", {
    stage, discipline: field, verified, components: shown, groupLabel: (stagedLevels.at(-1) || unstagedLevels.at(-1)!).label,
  });
}
