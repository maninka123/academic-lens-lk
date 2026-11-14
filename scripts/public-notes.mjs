// Turns an internal collection note into the short, neutral note that may be published.
//
// The full note stays in the private `Data files/**/academics.csv`. Only provenance
// statements ("Added from the official ... staff page (date)") are published. Internal
// investigation wording, employment-status remarks and third-party personal profile
// links (LinkedIn, Facebook, X, Instagram, YouTube, TikTok) are removed.

/** Personal or social profile hosts that must never be published. */
export const SOCIAL_URL = /(linkedin|facebook|fb\.com|twitter|x\.com|instagram|youtube|youtu\.be|tiktok|t\.me|wa\.me|whatsapp)[\w.-]*\//i;

/** Wording that belongs to internal review or to an individual's employment situation. */
export const INTERNAL_PHRASES = [
  /\brequires?\s+(manual\s+)?review\b/i,
  /\bneeds?\s+(manual\s+)?review\b/i,
  /\bon\s+(study\s+|sabbatical\s+|maternity\s+|sick\s+)?leave\b/i,
  /\b(may|might)\s+have\s+(left|moved|retired|resigned)\b/i,
  /\bname\s+discrepanc/i,
  /\bsupplied\s+contact\b/i,
  /\bconflicting\b/i,
  /\bpreserve\b/i,
  /\bcurator\b/i,
  /\bcandidate\s+(list|queue)\b/i,
  /\b(unclear|uncertain)\b/i,
  /\b(deceased|passed\s+away|resigned|terminated|dismissed|suspended)\b/i,
];

const GENERIC_CLAUSES = [/;?\s*research identities and employment require review\.?/gi];

const dropSocial = (sentence) => {
  const m = sentence.match(/^(Other listed profiles\s*[—-]\s*)(.*?)(\.?)$/i);
  if (!m) return SOCIAL_URL.test(sentence) ? "" : sentence;
  const kept = m[2].split(/;\s*/).filter((item) => item && !SOCIAL_URL.test(item));
  return kept.length ? m[1] + kept.join("; ") + m[3] : "";
};

/** Returns the publishable version of a collection note (possibly an empty string). */
export function publicNote(text) {
  let t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  for (const re of GENERIC_CLAUSES) t = t.replace(re, ".");
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const kept = sentences
    .map(dropSocial)
    .map((s) => s.trim())
    .filter((s) => s && !INTERNAL_PHRASES.some((re) => re.test(s)));
  return kept.join(" ").replace(/\s+\./g, ".").replace(/\.{2,}/g, ".").trim();
}

/** Problems found in a value that is about to be (or has been) published. */
export function publicFieldProblems(value) {
  const v = String(value ?? "");
  const found = [];
  if (SOCIAL_URL.test(v)) found.push("social or personal profile link");
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(v)) found.push("email address");
  if (/(?<![\w/.=-])(\+94|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)/.test(v)) found.push("phone number");
  for (const re of INTERNAL_PHRASES) { const m = v.match(re); if (m) { found.push(`internal wording "${m[0]}"`); break; } }
  return found;
}
