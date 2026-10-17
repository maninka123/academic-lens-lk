// Match evidence by researcher identity, not incidental URL query parameters.
export function profileKey(value = "") {
  try {
    const u = new URL(value.trim());
    if (/^scholar\.google\./i.test(u.hostname))
      return "scholar:" + (u.searchParams.get("user") || u.pathname);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return value;
  }
}
export function resolveAlias(id, aliases) {
  const seen = new Set();
  while (aliases[id]) {
    if (seen.has(id)) throw Error("Circular academic alias: " + id);
    seen.add(id);
    id = aliases[id];
  }
  return id;
}
export function linkStatus(id, url, evidence, aliases) {
  if (!url) return "not_recorded";
  return (
    evidence
      .filter(
        (e) =>
          resolveAlias(e.academic_id, aliases) === id &&
          profileKey(e.profile_url) === profileKey(url),
      )
      .sort((a, b) => a.checked_at.localeCompare(b.checked_at))
      .at(-1)?.identity_verification_status || "recorded_unverified"
  );
}
export const metricFields = {
  publications: "total_publications",
  citations: "total_citations",
  recentCitations: "citations_2021_2025",
  hIndex: "h_index",
  q1: "total_q1_journal_publications",
  recentQ1: "q1_publications_2021_2025",
};
/** Fill absent app values from a successful OpenAlex lookup; preserve recorded provider values. */
export function openAlexFallback(row, lookup) {
  const fields = {}, evidence = [];
  if (!lookup?.openalex_id || !/(^|_)matched(_|$)/.test(lookup.status || "") ||
      /(^|_)(not|no|un)_?matched/.test(lookup.status || "")) return { fields, evidence };
  // Providers are never mixed within one person: when the recorded figures come from Google
  // Scholar or ResearchGate, OpenAlex does not top up the missing ones (its publication
  // counts sit on a different scale and would sit beside, say, a Scholar h-index).
  const recorded = Object.values(metricFields).some((c) => row[c] !== "" && row[c] != null);
  if (recorded && row.research_metrics_source && !/openalex/i.test(row.research_metrics_source))
    return { fields, evidence };
  for (const [metric, column] of Object.entries(metricFields)) {
    if (row[column] !== "" && row[column] != null) continue;
    const raw = lookup[column];
    if (raw == null || String(raw).trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw Error("Invalid OpenAlex " + column);
    fields[column] = String(value);
    evidence.push({ metric, value, source: "OpenAlex", url: lookup.openalex_id,
      date: lookup.checked_at || "", note: "Successful OpenAlex author match. " +
        (lookup.checked_at ? "Lookup checked on the recorded date." : "Retrieval date was not recorded in this saved snapshot.") });
  }
  return { fields, evidence };
}
export function metricEvidence(row, snapshots, observations, aliases) {
  const samePerson = (e) =>
    resolveAlias(e.academic_id, aliases) === row.academic_id;
  const ss = snapshots.filter(samePerson),
    os = observations.filter(samePerson);
  return Object.entries(metricFields).flatMap(([metric, column]) => {
    if (row[column] === "" || row[column] == null) return [];
    const value = Number(row[column]);
    const observed = os
      .filter(
        (e) =>
          e.metric === column && e.value !== "" && Number(e.value) === value,
      )
      .map((e) => ({
        source: e.platform,
        url: e.source_url,
        date: e.retrieved_at,
        note: e.notes,
      }));
    const snapshotColumn =
      metric === "publications"
        ? "publications"
        : metric === "citations"
          ? "citations"
          : null;
    const fallback = snapshotColumn
      ? ss
          .filter(
            (e) =>
              e[snapshotColumn] !== "" && Number(e[snapshotColumn]) === value,
          )
          .map((e) => ({
            source: e.source,
            url: e.profile_url,
            date: e.retrieved_at,
            note: e.freshness,
          }))
      : [];
    const selected = (observed.length ? observed : fallback)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    return [
      {
        metric,
        value,
        ...(selected || {
          source: row.research_metrics_source || "Not recorded",
          url: row.metrics_source_url || "",
          date: "",
          note: "Field-specific evidence has not been recorded.",
        }),
      },
    ];
  });
}
export function normaliseRank(position) {
  const rules = [
    [/senior professor/i, "Senior Professor"],
    [/ass(?:ociate|osiate) professor/i, "Associate Professor"],
    [/assistant professor/i, "Assistant Professor"],
    [/professor/i, "Professor"],
    [/senior lecturer/i, "Senior Lecturer"],
    [/assistant lecturer/i, "Assistant Lecturer"],
    [/lecturer/i, "Lecturer"],
    [/librarian/i, "Librarian"],
    [/instructor/i, "Instructor"],
  ];
  return (
    rules.find(([pattern]) => pattern.test(position))?.[1] ||
    (position ? "Other" : "Unknown")
  );
}

// ---------------------------------------------------------------------------
// Doctorate interpretation. A completed doctorate needs explicit evidence: a
// documented completion status or qualification text naming a doctorate. A
// university name, an academic title ("Dr", "Professor") or ambiguous text is
// never treated as proof of completion.
const DOCTORATE =
  /\b(ph\.?\s?d|d\.?\s?phil|doctor of philosophy|dr\.?\s?rer\.?\s?nat|doctorat(?:e)?|d\.?\s?eng)\b/i;
const ONGOING = new RegExp(
  String.raw`(?:ph\.?\s?d|d\.?\s?phil|doctora\w*)[^;,]{0,40}?\b(?:reading|candidate|candidature|pursuing|ongoing|registered|in progress|submitted|undergoing|following|student|scholar)\b` +
    String.raw`|\b(?:reading|candidate|pursuing|ongoing|registered|following|reading for|studying for)\b[^;,]{0,30}?(?:ph\.?\s?d|d\.?\s?phil|doctora\w*)` +
    // Sri Lankan conventions: "Ph.D (R)" and "PhD (FGS, UOC)- Reading" both mean reading for the degree.
    String.raw`|(?:ph\.?\s?d|d\.?\s?phil)\.?\s*\(\s*r\s*\)|(?:ph\.?\s?d|d\.?\s?phil)\.?\s*\([^)]{0,40}\)\s*-\s*reading\b`,
  "i",
);
// "University of Reading" / "Reading, UK" is an awarding institution, not "reading for".
const READING_UNIVERSITY =
  /university\s+of\s+reading|\breading\s*,?\s*(?:u\.?\s?k\b|united kingdom|england)/gi;
const HONORARY = /\bhonor(?:ary|is causa)\b|\bh\.?\s?c\.?\b/i;
/**
 * @returns {"completed_documented"|"in_progress"|"contradictory"|"unknown"}
 */
export function doctorateStatus({ phd_status = "", qualifications = "" }) {
  const q = String(qualifications || "").replace(
    READING_UNIVERSITY,
    "University of R.",
  );
  const ongoing = ONGOING.test(q);
  // A doctorate named outside the ongoing phrase (e.g. "PhD (Colombo); reading DSc").
  const withoutOngoing = q.replace(new RegExp(ONGOING.source, "gi"), " ");
  const completedText = DOCTORATE.test(withoutOngoing) && !HONORARY.test(q);
  const status = String(phd_status || "");
  if (status === "in_progress")
    return completedText ? "contradictory" : "in_progress";
  if (status === "listed_completed" || status === "completed")
    return ongoing && !completedText ? "contradictory" : "completed_documented";
  if (completedText) return "completed_documented";
  if (ongoing) return "in_progress";
  return "unknown";
}
export const doctorateReview = {
  contradictory:
    "Qualification evidence contradicts the recorded doctorate status (e.g. completion recorded while the text describes an ongoing doctorate). It is not counted as a completed PhD until reviewed.",
};

// ---------------------------------------------------------------------------
// Published URLs keep only what identifies the page. Signed tokens, session
// and tracking parameters are removed before anything reaches public assets.
const DROP_PARAM =
  /^(utm_\w+|hl|oi|authuser|gmla|fbclid|gclid|mc_eid|pli|sessionid|session|sid|token|access_token|auth|key|api_key|apikey|sig|signature|awsaccesskeyid|expires|x-amz-.*|password|pass|ved|ei|usg|sa|source|ref|_hs\w+)$/i;
export function sanitizeUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!["http:", "https:"].includes(u.protocol)) return "";
  u.username = "";
  u.password = "";
  if (/^scholar\.google\./i.test(u.hostname)) {
    const user = u.searchParams.get("user");
    u.search = user ? "?user=" + encodeURIComponent(user) : "";
  } else {
    for (const k of [...u.searchParams.keys()])
      if (DROP_PARAM.test(k)) u.searchParams.delete(k);
  }
  u.hash = "";
  return u.href;
}
/** Sanitise every http(s) URL embedded in free text. */
export const sanitizeText = (text = "") =>
  String(text || "").replace(/https?:\/\/[^\s,;"')]+/g, (m) => sanitizeUrl(m));

// ---------------------------------------------------------------------------
// Bibliometric provider of an individual metric value.
export function providerOf(source = "") {
  const s = String(source || "");
  if (/scholar/i.test(s) && /researchgate/i.test(s)) return "Mixed";
  if (/scholar/i.test(s)) return "Google Scholar";
  if (/researchgate/i.test(s)) return "ResearchGate";
  if (/openalex/i.test(s)) return "OpenAlex";
  if (/scopus/i.test(s)) return "Scopus";
  return s ? "Other" : "Not recorded";
}
