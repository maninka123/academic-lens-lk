#!/usr/bin/env node
// Regenerates the README screenshots in docs/screenshots from the running app (real public data).
//   npm run dev -- --port 5173      (in another terminal)
//   node scripts/take-screenshots.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173/academic-lens-lk";
const OUT = "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });
const shots = [
  // [file, path, width, height, colour scheme, wait for text, full page]
  ["overview", "/", 1440, 900, "light", "Overview", true],
  ["universities", "/universities", 1440, 900, "light", "Institution", false],
  ["academics", "/academics", 1440, 900, "light", "", false],
  ["profile", "/academics/SL-c369ab0a9bb3", 1440, 900, "light", "", false],
  ["compare", "/compare", 1440, 900, "light", "", false],
  ["origins", "/origins", 1440, 900, "light", "", false],
  ["global", "/global", 1440, 900, "light", "", false],
  ["methodology", "/methodology", 1440, 900, "light", "", false],
  ["institution", "/university/peradeniya", 1440, 900, "light", "", false],
  ["dark", "/universities", 1440, 900, "dark", "Institution", false],
  ["mobile", "/", 390, 844, "light", "", false],
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, path, width, height, scheme, , full] of shots) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem("lanka-academia-last-visit-v2", String(Date.now())));
  const page = await ctx.newPage();
  await page.goto(BASE + "/#" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", name);
  await ctx.close();
}
await browser.close();
