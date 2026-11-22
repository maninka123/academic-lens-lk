/** Where the plain-English interpretation guide lives, and the short wording shown beside individual scores. */
export const GUIDE_PATH = "/guide";
/** Full address for places outside the router (the first-visit notice opens it in a new tab; reports are static). */
export const GUIDE_URL = "https://maninka123.github.io/academic-lens-lk/#/guide";
export const guideHref = () => import.meta.env.BASE_URL + "#" + GUIDE_PATH;
export const PRIVACY_URL = "https://github.com/maninka123/academic-lens-lk/blob/main/App/docs/legal/PRIVACY.md";
export const SCORE_DISCLAIMER =
  "Indicative research statistics only. Not a measure of academic quality or professional competence.";
