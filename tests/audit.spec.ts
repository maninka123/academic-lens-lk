import { useSyntheticFixture } from "./fixtures-helper";
import { test, expect } from "@playwright/test";

test("desktop, tablet and narrow mobile route audit", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "",
      "academics",
      "compare",
      "origins",
      "methodology",
      "global",
      "university/colombo",
    ]) {
      await page.goto("./#/" + route);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `page overflow: ${route} at ${width}`,
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          parseFloat(getComputedStyle(document.documentElement).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
      if (width === 390 || width === 1024)
        await page.screenshot({
          path: `output/playwright/audit-${route || "overview"}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "output/playwright/audit-dark.png" });
  expect(errors).toEqual([]);
});

test("faculty-only membership, correct routes and reference fallback", async ({
  page,
}) => {
  await page.goto("./#/academics");
  await page.getByLabel("Search people by name").fill("Janaka Liyanagama");
  await page.locator(".academic-name").click();
  await expect(
    page
      .getByRole("navigation", { name: "Academic hierarchy" })
      .getByRole("link"),
  ).toHaveCount(2);
  await expect(
    page
      .getByLabel("Peer context")
      .getByRole("option", { name: "Department", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Same department", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Academic hierarchy" })
    .getByRole("link", { name: "Faculty of Engineering", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All academics in this faculty", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Department unavailable", exact: true }),
  ).toHaveCount(0);
  await page.goto("./#/academics");
  await page.getByLabel("Search people by name").fill("Janaka Liyanagama");
  await page.locator(".academic-name").click();
  await page.getByRole("button", { name: "Compare this academic" }).click();
  await expect(page.getByLabel("Peer group")).toHaveValue("faculty");
  await page.goto("./#/university/cinec/faculty/not-a-faculty");
  await expect(
    page.getByRole("heading", { name: "Unit not found" }),
  ).toBeVisible();
});

test("chart switching, empty filters, fullscreen and keyboard escape", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./#/compare");
  await useSyntheticFixture(page);
  await page.reload();
  await page.getByLabel("Chart type").selectOption("scatter");
  await page
    .getByText("Logarithmic scale (positive values)", { exact: true })
    .locator("input")
    .check();
  for (const chart of [
    "box",
    "histogram",
    "heatmap",
    "treemap",
    "bar",
    "bubble",
    "grouped",
    "stacked",
    "percentStacked",
  ]) {
    await page.getByLabel("Chart type").selectOption(chart);
    await expect(page.locator(".studio-main canvas").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Expand chart" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator("canvas").first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".studio-main canvas").first()).toBeVisible();
  await page.getByLabel("Chart type").selectOption("bar");
  await page.getByLabel("Measurement", { exact: true }).selectOption("hIndex");
  await expect(
    page
      .getByLabel("Aggregation")
      .getByRole("option", { name: "Combined career total" }),
  ).toHaveCount(0);
  await page.getByText("Refine compared profiles", { exact: true }).click();
  await page
    .getByLabel("Search profiles", { exact: true })
    .fill("No Such Person xyz");
  await expect(
    page.getByRole("heading", { name: "No available values" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("the data source is fixed, including stale browser preferences and old demo links", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "academic-atlas-v1",
      JSON.stringify({ state: { mode: "demo", theme: "light" }, version: 0 }),
    ),
  );
  await page.goto("./#/academics");
  await expect(
    page.getByRole("combobox", { name: "Dataset", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("1,393 matching profiles", { exact: false }),
  ).toBeVisible();
  const view = JSON.stringify({
    v: 1,
    mode: "demo",
    pinned: [],
    custom: [],
    config: {
      metric: "citations",
      level: "university",
      chart: "bar",
      groups: [],
    },
    filters: {},
  });
  await page.goto("./#/compare?view=" + encodeURIComponent(view));
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(
    page.getByText(/Data updated/),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Dataset", exact: true }),
  ).toHaveCount(0);
});

test("real-data screenshots for the published README", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1350 });
  await page.goto("./#/academics/SL-ec237eee4737");
  await expect(
    page.getByRole("heading", {
      name: "Dr Janaka Wijayanayake*",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Compare with", { exact: true })
    .selectOption("qualification");
  await page
    .getByLabel("Peer context", { exact: true })
    .selectOption("faculty");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/person-profile.png" });
  await page.getByRole("button", { name: "Compare this academic" }).click();
  await page.getByLabel("Chart type").selectOption("scatter");
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.screenshot({ path: "docs/screenshots/comparison-studio.png" });
  await page.getByRole("link", { name: "PhD Origins", exact: true }).click();
  await expect(page.getByRole("img", { name: "World map of PhD awarding countries" })).toBeVisible();
  await page.locator(".card").filter({ has: page.getByRole("heading", { name: "A world of academic pathways" }) }).screenshot({ path: "docs/screenshots/phd-origins.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#/academics/SL-ec237eee4737");
  await page.screenshot({ path: "docs/screenshots/person-mobile.png" });
});

test("skip link retains the route and mobile navigation traps focus and closes with Escape", async ({
  page,
}) => {
  await page.goto("./#/compare");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/compare$/);
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("link", { name: "Project on GitHub" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeFocused();
});
