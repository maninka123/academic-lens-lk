import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateUsage } from "./usage-schema.mjs";
import { buildPrivateExport, buildPublicUsage } from "./usage-export.mjs";
import { checkPublicData, PUBLIC_FILES } from "./public-assets.mjs";

const rows = [
  { date: "2026-12-01", country: "Sri Lanka", referrer: "google.com", visits: 2, pageViews: 3 },
  { date: "2026-12-01", country: "Australia", referrer: "", visits: 1, pageViews: 2 },
  { date: "2026-12-02", country: "Sri Lanka", referrer: "", visits: 1, pageViews: 1 },
];
const opts = { periodStart: "2026-12-01", periodEnd: "2026-12-02", exportedAt: "2026-12-03T00:00:00.000Z" };

test("the private export keeps countries and referrers as counts only", () => {
  const e = buildPrivateExport(rows, opts);
  assert.deepEqual(e.totals, { visits: 4, pageViews: 6 });
  assert.equal(e.byCountry["Sri Lanka"], 4);
  assert.equal(e.byReferrer["google.com"], 3);
  assert.match(e.meta.note, /No visitor identifiers/);
});

test("the public aggregate has totals and daily visits and page views only", () => {
  const pub = buildPublicUsage(buildPrivateExport(rows, opts), "2026-12-03");
  assert.deepEqual(Object.keys(pub).sort(), ["daily", "pageViews", "periodEnd", "periodStart", "schemaVersion", "source", "updated", "visits"]);
  assert.deepEqual(pub.daily, [{ date: "2026-12-01", visits: 3, pageViews: 5 }, { date: "2026-12-02", visits: 1, pageViews: 1 }]);
  assert.doesNotMatch(JSON.stringify(pub), /Sri Lanka|google/);
  assert.deepEqual(validateUsage(pub), []);
});

test("anything beyond approved aggregates is rejected", () => {
  const ok = buildPublicUsage(buildPrivateExport(rows, opts), "2026-12-03");
  for (const [k, v] of [["country", "LK"], ["byCountry", {}], ["referrers", ["x"]], ["token", "abc"]])
    assert.ok(validateUsage({ ...ok, [k]: v }).length, k);
  assert.ok(validateUsage({ ...ok, daily: [{ ...ok.daily[0], path: "/x" }, ok.daily[1]] }).length);
  assert.ok(validateUsage({ ...ok, daily: [{ ...ok.daily[0], pageViews: 4 }, ok.daily[1]] }).some((x) => /add up/.test(x)));
  assert.ok(validateUsage({ ...ok, daily: [{ date: "2026-12-01", pageViews: 5 }, ok.daily[1]] }).some((x) => /daily visits/.test(x)));
  assert.ok(validateUsage({ ...ok, daily: [{ ...ok.daily[0], visits: 2 }, ok.daily[1]] }).some((x) => /visits must add up/.test(x)));
  assert.ok(validateUsage({ ...ok, daily: [{ ...ok.daily[0], visits: 9 }, ok.daily[1]] }).some((x) => /cannot exceed/.test(x)));
  assert.ok(validateUsage({ ...ok, uniqueVisitors: 3 }).length);
  assert.ok(validateUsage({ ...ok, periodStart: "2024-01-01", periodEnd: "2026-12-02" }).some((x) => /longer than/.test(x)));
  assert.ok(validateUsage({ ...ok, visits: 99 }).some((x) => /exceed/.test(x)));
  assert.ok(validateUsage(null).length && validateUsage([]).length);
});

test("the published data check accepts a valid usage file and rejects a leaky one", () => {
  assert.ok(PUBLIC_FILES.includes("platform_usage.json"));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "usage-"));
  const pub = buildPublicUsage(buildPrivateExport(rows, opts), "2026-12-03");
  fs.writeFileSync(path.join(d, "platform_usage.json"), JSON.stringify(pub));
  assert.deepEqual(checkPublicData(d), []);
  fs.writeFileSync(path.join(d, "platform_usage.json"), JSON.stringify({ ...pub, byCountry: { LK: 4 } }));
  assert.ok(checkPublicData(d).some((x) => /not allowed/.test(x)));
});

test("the Cloudflare snippet in index.html loads once, with a guard, and adds no cookie or storage", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.equal((html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length, 1);
  assert.equal((html.match(/64b3254549944e9085a182137f95ba45/g) || []).length, 1);
  assert.match(html, /querySelector\("script\[data-cf-beacon\]"\)/); // never added twice
  assert.match(html, /doNotTrack/);
  assert.match(html, /globalPrivacyControl/);
  assert.match(html, /localhost/);
  assert.doesNotMatch(html.replace(/\/\*[\s\S]*?\*\//g, ""), /document\.cookie|localStorage|sessionStorage|fingerprint/i);
});
