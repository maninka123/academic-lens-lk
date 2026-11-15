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
  t = t.replace(/\buser[- ]supplied\b/gi, "saved");
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

// ---------------------------------------------------------------------------
// Structured and free-text fields published besides `notes`. Internal originals stay in the
// private files; these functions only decide what the public data carries.
// ---------------------------------------------------------------------------

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?<![\w/.=-])(?:\+94|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g;

/** Removes email addresses, phone numbers, personal social links and their labels from a text field. */
export function stripContactDetails(text) {
  let t = String(text ?? "");
  if (!t) return "";
  // Leave text without contact details exactly as recorded.
  if (!/[\w.+-]+@[\w-]+\.|(?:\+94|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|\b(?:e-?\s?mail|email|mail|tel(?:ephone)?\.?(?:\s*no\.?)?|phone|mobile|fax|intercom)(?:\s*:|\s*[\-–]\s*[\d+])|\bContact\s*;|linkedin\.com|facebook\.com|twitter\.com|instagram\.com/i.test(t)) return t;
  // Website footer text scraped together with some staff profiles (contact block, menus, address).
  t = t.replace(/;?\s*Contact\s*;[^]*?Connect with us to explore new possibilities for your future\.[^]*$/i, "");
  t = t.replace(EMAIL, " ").replace(PHONE, " ");
  t = t.split(/(?<=[;|])\s*/).filter((part) => !SOCIAL_URL.test(part)).join(" ");
  // A contact label counts only when it introduces a value (colon, dash or number), never inside a topic such as "Mobile computing".
  t = t.replace(/\b(?:e-?\s?mail|email|mail|tel(?:ephone)?\.?(?:\s*no\.?)?|phone|mobile|fax|intercom(?:\s+extension)?)(?:\s*:\s*(?:\d{2,4}(?:\s*\/\s*\d{2,4})*)?|\s*[\-–]\s*(?=[\d+])|\s+(?=\d{2,4}\b))/gi, " ");
  t = t.replace(/\b(?:e-?\s?mail\s+)?linkedin\s*$/gi, " ");
  t = t.replace(/\s*;(?:\s*;)+/g, ";");
  return t.replace(/\s{2,}/g, " ").replace(/\s+([;,.])/g, "$1").replace(/(^[\s;,.|-]+|[\s;,|-]+$)/g, "").trim();
}

/** Removes a parenthetical remark about leave from a name or position ("Lecturer (On study leave)"). */
export function stripLeaveRemark(text) {
  return String(text ?? "")
    .replace(/\s*[(\[][^)\]]*\bleave\b[^)\]]*[)\]]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Reader-facing wording for a metric evidence note: internal process words are replaced by neutral provenance. */
export function publicEvidenceNote(text) {
  return String(text ?? "")
    .replace(/User-provided snapshot; not independently re-fetched in this merge\.?/gi, "Snapshot of the public profile; not re-fetched since.")
    .replace(/\bsearch_indexed_snapshot\b/g, "Search-indexed snapshot of the public profile.")
    .replace(/\buser[- ]provided\b/gi, "saved")
    .replace(/\bin this merge\b/gi, "since")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Identity statuses that mean "this is not the person" are never published, and review wording is neutralised. */
export const isRejectedIdentity = (status) => /^rejected/i.test(String(status ?? ""));
const pending = (s) => s.replace(/_not_person_scoped/g, "").replace(/requires?_review/g, "pending_review").replace(/requires?_corroboration/g, "pending_corroboration");
export function publicLinkStatus(status) {
  const s = String(status ?? "");
  if (isRejectedIdentity(s)) return "not_recorded";
  if (/conflict/i.test(s)) return "recorded_pending_review";
  return pending(s);
}
export const publicOpenAlexStatus = (status) => pending(String(status ?? ""));
export function publicRecordStatus(status) {
  const s = String(status ?? "");
  return /conflict|unclear/i.test(s) ? "listed_academic_employment_pending_review" : pending(s);
}
const METHOD_NAMES = {
  verified_official_link: "official_link",
  matched_user_supplied_platform_evidence: "platform_evidence",
  legacy_accepted_name_and_institution: "name_and_institution",
  manual_curator_decision: "manual_review",
  official_identifier: "official_identifier",
};
/** Neutral, public vocabulary for how an identity was established. */
export function publicMethod(method) {
  const m = String(method ?? "");
  if (/requires_review|conflict|not_person_scoped|awaiting|not_accepted|rejected/i.test(m)) return "recorded_unverified";
  return METHOD_NAMES[m] || m;
}

/** Internal vocabulary that must not appear in structured or status columns of published data. */
export const INTERNAL_TOKENS = /requires_review|requires_corroboration|rejected|curator|user[_ -]?provided|in this merge|conflict(?:ing)?_|identity_conflict|not_person_scoped|awaiting_publication/i;

/** Email addresses, phone numbers and personal social links in a published value. */
export function contactProblems(value) {
  const v = String(value ?? "");
  const found = [];
  if (SOCIAL_URL.test(v)) found.push("social or personal profile link");
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(v)) found.push("email address");
  if (/(?<![\w/.=-])(\+94|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)/.test(v)) found.push("phone number");
  return found;
}
/** A remark about leave in a name or position. */
export const leaveRemarkProblems = (value) => (stripLeaveRemark(value) !== String(value ?? "") ? ["remark about leave"] : []);
