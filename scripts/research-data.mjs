// Curated research identity metadata and source-separated observations.
// Candidate evidence and private review decisions are never published.
import fs from "node:fs";
import { csvRead } from "./shared.mjs";
import { resolveAlias, profileKey, linkStatus, metricFields, sanitizeUrl } from "./evidence.mjs";
const accepted = new Set(["confirmed", "corroborated"]);
export function researchInputs(source, aliases = {}) {
  const read = name => fs.existsSync(`${source}/${name}`) ? csvRead(`${source}/${name}`) : [];
  const matches = read("research_identity_matches.csv");
  const byId = new Map(matches.map(r => [resolveAlias(r.academic_id, aliases), r]));
  return { byId, observations: read("research_metric_observations.csv"), snapshots: read("research_metrics_snapshots.csv"), identities: read("research_identity_evidence.csv") };
}
export function publicMatch(row, lookup, inputs) {
  const m = inputs.byId.get(row.academic_id);
  if (m) return { level: m.match_status, approved: m.publication_status === "approved" && accepted.has(m.match_status), url: m.publication_status === "approved" && accepted.has(m.match_status) ? sanitizeUrl(m.candidate_author_id) : "", method: m.publication_status === "approved" ? m.match_method : "awaiting_publication_review", date: m.matched_at || "" };
  const previous = Boolean(lookup?.openalex_id && /(^|_)matched(_|$)/.test(lookup.status || ""));
  return { level: previous ? "corroborated" : /candidate|multiple/.test(lookup?.status || "") ? "possible" : "unresolved", approved: previous, url: previous ? sanitizeUrl(lookup.openalex_id) : "", method: previous ? "legacy_accepted_name_and_institution" : "not_accepted", date: lookup?.checked_at || "" };
}
export function publicResearch(row, lookup, inputs, aliases = {}, fallbackEvidence = []) {
  const match = publicMatch(row, lookup, inputs);
  const identities = [];
  for (const [provider, url] of [["Google Scholar", row.google_scholar_url], ["ResearchGate", row.researchgate_url]]) {
    if (!url) continue;
    const status = linkStatus(row.academic_id, url, inputs.identities, aliases);
    identities.push({ provider, status: ["verified_official_link", "matched_user_supplied_platform_evidence"].includes(status) ? "confirmed" : "possible", url: sanitizeUrl(url), method: status, date: "" });
  }
  if (match.approved) identities.push({ provider: "OpenAlex", status: match.level, url: match.url, method: match.method, date: match.date });
  const observations = [];
  const push = (metric, value, provider, url, date, explicitLevel) => {
    const n = Number(value);
    if (value == null || value === "" || !Number.isFinite(n) || n < 0 || !/^https?:/.test(url || "")) return;
    const identity = identities.find(i => i.provider === provider && profileKey(i.url) === profileKey(url));
    if (provider === "OpenAlex" && (!match.approved || profileKey(match.url) !== profileKey(url))) return;
    observations.push({ metric, value: n, provider, url: sanitizeUrl(url), date: date || "", identityStatus: explicitLevel || identity?.status || "possible" });
  };
  for (const r of inputs.observations.filter(r => resolveAlias(r.academic_id, aliases) === row.academic_id)) {
    const metric = Object.entries(metricFields).find(([,col]) => col === r.metric)?.[0];
    if (metric) push(metric, r.value, r.platform, r.source_url, r.retrieved_at);
  }
  for (const e of fallbackEvidence) push(e.metric, e.value, e.source, e.url, e.date);
  if (match.approved && lookup) for (const [metric, column] of Object.entries(metricFields)) push(metric, lookup[column], "OpenAlex", lookup.openalex_id, lookup.checked_at || match.date, match.level);
  // Latest observation per provider, metric and profile. Older observations stay in source files.
  const latest = new Map();
  for (const o of observations) {
    const key = `${o.provider}|${o.metric}|${profileKey(o.url)}`;
    if (!latest.has(key) || latest.get(key).date <= o.date) latest.set(key, o);
  }
  return { openAlexMatchLevel: match.approved ? match.level : accepted.has(match.level) ? "possible" : match.level, researchIdentities: JSON.stringify(identities), researchObservations: JSON.stringify([...latest.values()]) };
}
