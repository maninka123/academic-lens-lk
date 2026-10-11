import { useSyntheticFixture } from "./fixtures-helper";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const snapshot = JSON.parse(
  readFileSync("public/data/dataset_summary.json", "utf8"),
);
const records = Number(snapshot.academicRecords).toLocaleString("en");
test("real collection, comparison controls, profiles, exports, and screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: "Sri Lanka’s academic landscape.",
    }),
  ).toBeVisible();
  await expect(page.getByText(records, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("Published profiles — not the total academic population"),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/overview.png" });
  await page.getByRole("link", { name: "Academics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Academic Explorer" }),
  ).toBeVisible();
  const name = await page.locator("tbody .academic-name").first().textContent();
  await page.locator("tbody .academic-name").first().click();
  await expect(
    page.getByRole("heading", { name: name!, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare this academic" }).click();
  await expect(
    page.getByRole("heading", { name: "Comparison Studio" }),
  ).toBeVisible();
  await expect(page.locator(".pinned-card")).toHaveCount(1);
  await page.getByLabel("Measurement", { exact: true }).selectOption("q1");
  await expect(
    page.getByRole("heading", { name: "No available values" }),
  ).toBeVisible();
  await page
    .getByLabel("Measurement", { exact: true })
    .selectOption("citations");
  await page.getByLabel("Chart type").selectOption("scatter");
  await expect(page.locator(".pinned-card")).toHaveCount(1);
  await page.getByLabel("Peer group").selectOption("rank");
  await page.getByLabel("Comparison level").selectOption("type");
  await page.getByLabel("University weighting").selectOption("equal");
  await expect(
    page.getByText("Valid universities", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Chart type").selectOption("box");
  await page
    .getByRole("button", { name: "Export records", exact: true })
    .click();
  await expect(page.locator(".pinned-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("fixture comparisons, custom groups, share state and chart exports", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./#/compare");
  await useSyntheticFixture(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Comparison Studio" }),
  ).toBeVisible();
  await page
    .getByLabel("Measurement", { exact: true })
    .selectOption("recentCitations");
  for (const mode of ["total", "mean", "median"]) {
    await page.getByLabel("Aggregation", { exact: true }).selectOption(mode);
    await expect(page.locator(".studio-main tbody tr")).toHaveCount(15);
  }
  for (const i of [1, 2, 3]) {
    if (i === 1)
      await page.getByRole("button", { name: "Show pinned academics" }).click();
    const name = "Demo Academic " + String(i).padStart(2, "0") + "002";
    await page.getByLabel("Add Academic").fill(name);
    await page.locator(".search-results button").first().click();
  }
  await expect(page.locator(".pinned-card")).toHaveCount(3);
  await page.getByLabel("Chart type").selectOption("scatter");
  await expect(page.locator(".studio-main canvas")).toBeVisible();
  await page.getByLabel("Peer group").selectOption("rank");
  await page.screenshot({ path: "output/playwright/fixture-comparison.png" });
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export chart as PNG" })
    .first()
    .click();
  expect((await dl).suggestedFilename()).toContain(".png");
  await page
    .locator("summary")
    .filter({ hasText: "Custom academic groups" })
    .click();
  await page.getByLabel("Group name", { exact: true }).fill("Test group A");
  await page.getByRole("button", { name: "Save 3 pinned academics" }).click();
  await expect(page.getByLabel("Comparison level")).toHaveValue("custom");
  await page.getByRole("button", { name: "Share comparison" }).click();
  await expect(page.getByText("Comparison link copied.")).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("view=");
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator(".pinned-card")).toHaveCount(3);
  await expect(page.getByLabel("Comparison level")).toHaveValue("custom");
  await page.getByRole("link", { name: "PhD Origins", exact: true }).click();
  await page.getByRole("button", { name: /Australia \d/ }).click();
  await expect(
    page.getByRole("button", { name: "Clear Australia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Academics with a documented PhD from Australia",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "output/playwright/fixture-origins.png" });
  expect(errors).toEqual([]);
});
test("responsive layout, readable text, and appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: "Sri Lanka’s academic landscape.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page
    .getByRole("button", { name: "Show controls", exact: true })
    .click();
  await expect(page.getByLabel("Measurement", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: false,
  });
});

test("people search, hierarchy, qualification and position comparisons on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./#/academics");
  await useSyntheticFixture(page);
  await page.reload();
  await page.getByLabel("Search people by name").fill("Demo Academic 01002");
  await expect(page.locator("tbody .academic-name")).toHaveCount(1);
  await page.locator("tbody .academic-name").click();
  await expect(
    page.getByRole("heading", { name: "Where this person stands" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Academic hierarchy" })
      .getByRole("link"),
  ).toHaveCount(3);
  await expect(page.getByLabel("Compare with", { exact: true })).toHaveValue(
    "position",
  );
  await page.getByLabel("Compare with", { exact: true }).selectOption("phd");
  await page
    .getByLabel("Peer context", { exact: true })
    .selectOption("department");
  await page
    .getByLabel("Profile measurement", { exact: true })
    .selectOption("hIndex");
  await page.getByText("Detailed statistics", { exact: true }).click();
  await expect(page.locator(".peer-statistics table tbody tr")).toHaveCount(
    8,
  );
  await page.getByLabel("Compare with", { exact: true }).selectOption("both");
  await expect(page.getByLabel("Illustration style")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/fixture-profile.png",
    fullPage: false,
  });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export this person’s record" })
    .click();
  expect((await download).suggestedFilename()).toContain(".csv");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Compare with", { exact: true })
    .selectOption("qualification");
  await expect(page.getByLabel("Peer context", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "output/playwright/fixture-profile-mobile.png",
    fullPage: false,
  });
  expect(errors).toEqual([]);
});

test("coverage, single-provider rules, international benchmarks and statistics export", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Institution: three kinds of completeness instead of a staff total.
  await page.goto("./#/university/colombo");
  await expect(
    page.getByText("Verified research identity").first(),
  ).toBeVisible();
  await expect(page.getByText(/not a staff census/i).first()).toBeVisible();
  // Compare: one provider by default, mixed only as a labelled mode.
  await page.goto("./#/compare");
  await expect(page.getByLabel("Bibliometric provider")).toHaveValue(
    "Google Scholar",
  );
  await expect(page.getByText(/Single provider/i).first()).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statistics" }).click();
  const file = await dl;
  const text = readFileSync(await file.path(), "utf8");
  expect(text).toContain("# Dataset version: " + snapshot.version);
  expect(text).toContain("# Metric provider: Google Scholar");
  expect(text).toMatch(
    /valid_observations,missing_observations,eligible_records/,
  );
  await page.getByLabel("Bibliometric provider").selectOption("mixed");
  await expect(page.getByText(/Exploratory mode/).first()).toBeVisible();
  // Global: like-for-like by default, matched counts and suppression shown.
  await page
    .getByRole("link", { name: "Global Benchmarks", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Global benchmarks" }),
  ).toBeVisible();
  await expect(page.getByLabel("Comparison provider")).toHaveValue(
    "likeForLike",
  );
  await expect(page.getByText(/Sri Lankan matches/).first()).toBeVisible();
  await page.screenshot({ path: "output/playwright/global.png" });
  // PhD Origins: only documented doctorates, with the association caveat.
  await page.getByRole("link", { name: "PhD Origins", exact: true }).click();
  await expect(page.getByText(/documented/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Doctorate origins by institution",
    }),
  ).toBeVisible();
  // Methodology: research methodology and correction process are published.
  await page
    .getByRole("link", { name: "Data & Methodology", exact: true })
    .first()
    .click();
  await expect(page.getByText("Three kinds of completeness")).toBeVisible();
  await expect(
    page.getByText("Corrections or removal"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
