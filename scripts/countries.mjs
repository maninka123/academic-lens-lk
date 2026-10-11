// Country profiles: the lightweight extension point for adding national
// datasets. Each profile names its dataset folder, institution manifest and the
// rules that map published position titles onto the shared position scale.
// Original titles are always kept in `position`; only `rank` is normalised.
import { normaliseRank } from "./evidence.mjs";

/** Shared, cross-country position scale (career stages are approximate). */
export const CAREER_STAGE = {
  "Senior Professor": "Professor",
  Professor: "Professor",
  "Associate Professor": "Mid-career",
  "Senior Lecturer": "Mid-career",
  "Assistant Professor": "Early-career",
  Lecturer: "Early-career",
  "Assistant Lecturer": "Early-career",
  Instructor: "Teaching / other",
  Librarian: "Teaching / other",
  Other: "Teaching / other",
  Unknown: "Unknown",
};
export const careerStage = (rank) => CAREER_STAGE[rank] || "Unknown";

// Order matters: 副教授 and 助理教授 contain 教授.
const NON_ENGLISH_RANKS = [
  [
    /副教授|副研究员|professeure? agrégée?|associate professor/i,
    "Associate Professor",
  ],
  [
    /助理教授|助理研究员|professeure? adjointe?|jun\.-prof|junior prof|assistant professor|professeur assistant|professeure assistante/i,
    "Assistant Professor",
  ],
  [
    /教授|院士|研究员|^professeure?\b|professeure? des universit|univ\.-prof|^prof\.|directeu?r(ice)? de recherche/i,
    "Professor",
  ],
  [
    /讲师|ma[iî]tre(sse)? de conf|chargée? de recherche|chargée? d'enseignement|enseignant/i,
    "Lecturer",
  ],
];

/** Normalise a published position for a given country profile. */
export function rankFor(position, country = "Sri Lanka") {
  const r = normaliseRank(position || "");
  if (country === "Sri Lanka" || !["Other", "Unknown"].includes(r)) return r;
  return NON_ENGLISH_RANKS.find(([re]) => re.test(position || ""))?.[1] || r;
}

export const COUNTRY_PROFILES = {
  "Sri Lanka": {
    code: "LK",
    role: "primary",
    source: "Data files/universities",
    description:
      "National collection of published academic profiles (partial, not a census).",
    researcherIds: ["Google Scholar", "ResearchGate", "OpenAlex"],
  },
  International: {
    code: "INT",
    role: "benchmark-sample",
    source: "Data files/international",
    description:
      "QS 2027 tier samples from seven countries (Computer Science and Physics). Samples, not national censuses.",
    researcherIds: ["OpenAlex"],
  },
};
