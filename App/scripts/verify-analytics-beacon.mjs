import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
// Manual check of the Cloudflare beacon against the built site (npm run build first). Serves dist/ under the real hostname, records the
// beacon's requests without sending anything to Cloudflare, and walks several hash routes. Needs network access to load the beacon script.
const DIST = path.resolve("dist");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".csv": "text/csv", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".webp": "image/webp" };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("lanka-academia-last-visit-v2", String(Date.now())));
const events = [], beaconLoads = [];
await ctx.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === "maninka123.github.io") {
    let rel = decodeURIComponent(u.pathname).replace(/^\/academic-lens-lk\/?/, "");
    let f = path.join(DIST, rel || "index.html");
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
    return route.fulfill({ status: 200, contentType: mime[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  }
  if (/cloudflareinsights\.com\/cdn-cgi\/rum/.test(route.request().url())) {
    let body = route.request().postData() || "";
    try { body = JSON.parse(body); } catch {}
    events.push({ t: Date.now(), body });
    return route.fulfill({ status: 204, body: "" });
  }
  if (/static\.cloudflareinsights\.com\/beacon/.test(route.request().url())) beaconLoads.push(1);
  return route.continue();
});
const page = await ctx.newPage();
await page.goto("https://maninka123.github.io/academic-lens-lk/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log("beacon script tags:", await page.locator("script[data-cf-beacon]").count(), "| beacon file loads:", beaconLoads.length);
const step = async (label, fn) => { const n = events.length; await fn(); await page.waitForTimeout(2200); console.log(label.padEnd(34), "new beacon events:", events.length - n, "| url:", page.url().replace("https://maninka123.github.io", "")); };
await step("open Universities", () => page.getByRole("link", { name: "Universities" }).first().click());
await step("open Academics", () => page.getByRole("link", { name: "Academics" }).first().click());
await step("open Compare (hash route)", () => page.goto("https://maninka123.github.io/academic-lens-lk/#/compare"));
await step("open Methodology (hash route)", () => page.evaluate(() => { location.hash = "#/methodology"; }));
await page.close();
await new Promise((r) => setTimeout(r, 1500));
const views = events.filter((e) => e.body?.eventType === 1);
const places = new Set(views.map((e) => e.body.location));
console.log("page-view events (eventType 1):", views.length, "| distinct page addresses Cloudflare sees:", places.size, [...places].join(" "));
console.log(places.size === 1 ? "RESULT: hash routes are counted but all share one address; page-level breakdowns are not available." : "RESULT: routes are distinguishable.");
await browser.close();
