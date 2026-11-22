#!/usr/bin/env node
// Regenerates screenshots from the running app (real public data).
//   npm run dev -- --port 5173      (in another terminal)
//   node scripts/take-screenshots.mjs           README screenshots   -> docs/screenshots
//   node scripts/take-screenshots.mjs --guide   annotated guide images -> docs/guide
// Guide callouts use the app's design tokens: a numbered blue box says what a figure shows; a red cross box marks what it must not be read as.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5173/academic-lens-lk").replace(/\/$/, "");
const guide = process.argv.includes("--guide");
const OUT = guide ? "docs/guide" : "docs/screenshots";
fs.mkdirSync(OUT, { recursive: true });

// [file, route, width, height, colour scheme]
const readme = [
  ["overview", "/", 1440, 900, "light"],
  ["universities", "/universities", 1440, 900, "light"],
  ["academics", "/academics", 1440, 900, "light"],
  ["profile", "/academics/SL-c369ab0a9bb3", 1440, 900, "light"],
  ["compare", "/compare", 1440, 900, "light"],
  ["origins", "/origins", 1440, 900, "light"],
  ["global", "/global", 1440, 900, "light"],
  ["methodology", "/methodology", 1440, 900, "light"],
  ["institution", "/university/peradeniya", 1440, 900, "light"],
  ["dark", "/universities", 1440, 900, "dark"],
  ["mobile", "/", 390, 844, "light"],
];
// mark: [css selector, text the element must contain (or ""), ancestor to climb to (or ""), "means" | "not"]
const guideShots = [
  ["universities", "/universities", 1440, 760, "light", [[".uni-row", "", "", "means"], [".fact-strip", "", "", "not"]]],
  ["profile", "/academics/SL-c369ab0a9bb3", 1440, 560, "light", [["div", "Medium confidence", "", "means"], ["p", "Indicative research statistics only", "", "not"]]],
  ["origins", "/origins", 1440, 900, "light", [["select", "", "div", "means"], ["h2", "A world of academic pathways", ".card, section", "not"]]],
];

async function annotate(page, marks) {
  await page.evaluate((marks) => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    let n = 0;
    marks.forEach(([sel, text, climb, kind]) => {
      const cands = [...document.querySelectorAll(sel)].filter((e) => (!text || (e.textContent || "").includes(text)) && e.getBoundingClientRect().width > 20);
      let el = text ? cands[cands.length - 1] : cands[0]; // with text: the innermost match
      if (el && climb) el = el.closest(climb) || el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const colour = v(kind === "not" ? "--color-danger" : "--color-primary");
      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "fixed", left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: Math.min(r.height, innerHeight - r.top) + 8 + "px",
        border: "2px " + (kind === "not" ? "dashed " : "solid ") + colour, borderRadius: v("--radius-md"), pointerEvents: "none", zIndex: 99999, boxSizing: "border-box",
      });
      const dot = document.createElement("div");
      dot.textContent = kind === "not" ? "✕" : String(++n);
      Object.assign(dot.style, {
        position: "absolute", left: "-14px", top: "-14px", width: "26px", height: "26px", borderRadius: v("--radius-full"),
        background: colour, color: v("--color-primary-foreground"), font: "700 14px/26px " + v("--font-sans"), textAlign: "center", boxShadow: v("--shadow-md"),
      });
      box.appendChild(dot);
      document.body.appendChild(box);
    });
  }, marks);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const s of guide ? guideShots : readme) {
  const [name, path, width, height, scheme, marks] = s;
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem("lanka-academia-last-visit-v2", String(Date.now())));
  const page = await ctx.newPage();
  await page.goto(BASE + "/#" + path, { waitUntil: "networkidle" });
  if (scheme === "dark") await page.getByRole("button", { name: "Dark appearance" }).click();
  await page.waitForTimeout(2200);
  if (guide) await annotate(page, marks);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", name);
  await ctx.close();
}
await browser.close();
