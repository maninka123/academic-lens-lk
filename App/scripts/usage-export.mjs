#!/usr/bin/env node
// Private analytics export for the site owner. Cloudflare credentials stay on this machine (never in the repository,
// the frontend bundle or public assets). Run it locally, or from a private scheduled job with the token as a secret.
//
//   node scripts/usage-export.mjs --from 2026-12-01 --to 2026-12-31            fetch + keep a private dated export
//   node scripts/usage-export.mjs --from 2026-12-01 --to 2026-12-31 --publish   also write the approved public aggregate
//   node scripts/usage-export.mjs --publish-from ../private/analytics/exports/<file>.json   re-publish from a saved export
//   node scripts/usage-export.mjs --introspect                                  list the Web Analytics fields your account exposes
//
// Credentials (process env or ../private/analytics/.env): CF_API_TOKEN (read access to Account Analytics), CF_ACCOUNT_ID, CF_SITE_TAG.
// Private files go to ../private/analytics/exports/ (git-ignored): per-day totals, country and referral-host counts, and a manifest
// with a SHA-256 of every export. No visitor identifiers exist in the data.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { validateUsage, USAGE_FILE } from "./usage-schema.mjs";

export const SOURCE = "Cloudflare Web Analytics";
const PRIVATE_DIR = "../private/analytics/exports";
/** rows: [{date:"YYYY-MM-DD", country, referrer, visits, pageViews}] -> private aggregate export (counts only). */
export function buildPrivateExport(rows, { periodStart, periodEnd, exportedAt, source = SOURCE }) {
  const add = (m, k, v) => { if (k) m[k] = (m[k] || 0) + v; };
  const byDate = {}, byCountry = {}, byReferrer = {};
  let visits = 0, pageViews = 0;
  for (const r of rows) {
    const pv = Number(r.pageViews) || 0, vs = Number(r.visits) || 0;
    visits += vs; pageViews += pv;
    byDate[r.date] ||= { visits: 0, pageViews: 0 };
    byDate[r.date].visits += vs; byDate[r.date].pageViews += pv;
    add(byCountry, r.country, pv); add(byReferrer, r.referrer, pv);
  }
  return {
    meta: { source, periodStart, periodEnd, exportedAt, note: "Aggregate counts only. No visitor identifiers. Counts are measurements, not proof of who saw or believed a statement." },
    totals: { visits, pageViews },
    byDate, byCountry, byReferrer,
  };
}

/** Private export -> the public aggregate (totals and daily page views only). */
export function buildPublicUsage(exp, updated) {
  const days = Object.keys(exp.byDate).sort();
  const pub = {
    schemaVersion: 1, source: exp.meta.source, periodStart: exp.meta.periodStart, periodEnd: exp.meta.periodEnd, updated,
    visits: exp.totals.visits, pageViews: exp.totals.pageViews,
    daily: days.map((d) => ({ date: d, visits: exp.byDate[d].visits, pageViews: exp.byDate[d].pageViews })),
  };
  const problems = validateUsage(pub);
  if (problems.length) throw Error("Public usage failed validation:\n- " + problems.join("\n- "));
  return pub;
}

function loadEnv() {
  const env = { ...process.env };
  const f = "../private/analytics/.env";
  if (fs.existsSync(f))
    for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return env;
}
async function gql(token, query, variables) {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.errors?.length) throw Error("Cloudflare GraphQL error: " + (j.errors?.map((e) => e.message).join("; ") || res.status) + "\n(Field names can differ by account: run with --introspect and adjust QUERY.)");
  return j.data;
}
const QUERY = `query($acc:String!,$site:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$acc}){
  rumPageloadEventsAdaptiveGroups(limit:10000,filter:{siteTag:$site,date_geq:$from,date_leq:$to},orderBy:[date_ASC]){
    count sum{visits} dimensions{date countryName refererHost}}}}}`;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

async function fetchRows(env, from, to) {
  const rows = [];
  for (let s = from; s <= to; ) { // windows of at most 31 days: the API limits the query range
    const e = new Date(Math.min(Date.parse(s) + 30 * 864e5, Date.parse(to))).toISOString().slice(0, 10);
    const d = await gql(env.CF_API_TOKEN, QUERY, { acc: env.CF_ACCOUNT_ID, site: env.CF_SITE_TAG, from: s, to: e });
    for (const g of d.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [])
      rows.push({ date: g.dimensions.date, country: g.dimensions.countryName, referrer: g.dimensions.refererHost, visits: g.sum?.visits ?? 0, pageViews: g.count });
    s = new Date(Date.parse(e) + 864e5).toISOString().slice(0, 10);
  }
  return rows;
}

function saveExport(exp) {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  const name = `${exp.meta.periodStart}_${exp.meta.periodEnd}_exported-${exp.meta.exportedAt.replace(/[:.]/g, "-")}.json`;
  const text = JSON.stringify(exp, null, 2) + "\n";
  fs.writeFileSync(path.join(PRIVATE_DIR, name), text);
  const manifest = path.join(PRIVATE_DIR, "manifest.csv");
  if (!fs.existsSync(manifest)) fs.writeFileSync(manifest, "file,period_start,period_end,exported_at,sha256,page_views,visits\n");
  fs.appendFileSync(manifest, [name, exp.meta.periodStart, exp.meta.periodEnd, exp.meta.exportedAt, crypto.createHash("sha256").update(text).digest("hex"), exp.totals.pageViews, exp.totals.visits].join(",") + "\n");
  return path.join(PRIVATE_DIR, name);
}
const publish = (pub) => { fs.writeFileSync("public/data/" + USAGE_FILE, JSON.stringify(pub, null, 2) + "\n"); console.log("Wrote public/data/" + USAGE_FILE + " (review it, then commit it deliberately)."); };

async function main() {
  const a = process.argv.slice(2), opt = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null);
  const today = new Date().toISOString().slice(0, 10);
  if (opt("--publish-from")) { const exp = JSON.parse(fs.readFileSync(opt("--publish-from"), "utf8")); return publish(buildPublicUsage(exp, today)); }
  const env = loadEnv();
  for (const k of ["CF_API_TOKEN", "CF_ACCOUNT_ID", "CF_SITE_TAG"]) if (!env[k]) throw Error(`${k} is not set (process env or ../private/analytics/.env). Nothing was fetched.`);
  if (a.includes("--introspect")) {
    const d = await gql(env.CF_API_TOKEN, `{__type(name:"AccountRumPageloadEventsAdaptiveGroups"){name fields{name}}}`, {});
    return console.log(JSON.stringify(d, null, 2));
  }
  const from = opt("--from"), to = opt("--to");
  if (!from || !to || days(from, to) < 0) throw Error("Give --from and --to (YYYY-MM-DD).");
  const exp = buildPrivateExport(await fetchRows(env, from, to), { periodStart: from, periodEnd: to, exportedAt: new Date().toISOString() });
  console.log("Private export:", saveExport(exp));
  console.log("Totals:", exp.totals);
  if (a.includes("--publish")) publish(buildPublicUsage(exp, today));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
