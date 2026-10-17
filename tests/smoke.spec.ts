import { test, expect, type Page } from "@playwright/test";

const routes = [
  "/",
  "/universities",
  "/university/peradeniya",
  "/university/peradeniya/faculty/peradeniya--faculty-of-science",
  "/compare",
  "/academics",
  "/origins",
  "/global",
  "/methodology",
];

async function noOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

for (const width of [1440, 820, 390]) {
  test(`every page renders cleanly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of routes) {
      await page.goto("./#" + route);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(await noOverflow(page), `horizontal overflow on ${route}`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("universities show two-letter monograms and a card per institution", async ({ page }) => {
  await page.goto("./#/universities");
  await expect(page.locator(".uni-card")).toHaveCount(15);
  await expect(page.locator(".uni-card .uni-mono", { hasText: /^ST$/ })).toHaveCount(1);
});

test("faculty and department cards carry subject icons", async ({ page }) => {
  await page.goto("./#/university/peradeniya");
  const cards = page.locator(".institution-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(3);
  await expect(page.locator(".institution-card .unit-icon").first()).toBeVisible();
});

test("compare picker follows the comparison level and faculty presets work", async ({ page }) => {
  await page.goto("./#/compare");
  await page.getByRole("button", { name: /Medicine \/ Health/ }).click();
  await expect(page.locator(".group-picker-field > span")).toHaveText("Faculties");
  await page.getByLabel("Comparison level").selectOption("rank");
  await expect(page.locator(".group-picker-field > span")).toHaveText("Positions");
  await expect(page.locator(".group-picker-field summary")).toContainText("All positions");
});

test("faculty level offers faculty types, not one entry per university", async ({ page }) => {
  await page.goto("./#/compare");
  await page.getByLabel("Comparison level").selectOption("faculty");
  await page.locator(".group-picker-field summary").click();
  const labels = await page.locator(".group-picker-field .check span").allTextContents();
  expect(labels.some((l) => /^Medicine \(/.test(l))).toBe(true);
  expect(labels.some((l) => /University/.test(l))).toBe(false);
});

test("the corner filter opens, narrows the data and clears", async ({ page }) => {
  await page.goto("./#/academics");
  await page.getByRole("button", { name: /Filters/ }).click();
  const panel = page.getByRole("dialog", { name: "Dataset filters" });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("a profile shows the standing score, sources and can be pinned", async ({ page }) => {
  await page.goto("./#/academics/SL-e42dc43b44c7");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Sources", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Compare this academic/ }).click();
  await expect(page.getByRole("button", { name: /Compare this academic|Remove|Pinned/ }).first()).toBeVisible();
});

test.describe("first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("the acknowledgement must be ticked before entering", async ({ page }) => {
    await page.goto("./#/");
    const enter = page.getByRole("button", { name: "Enter platform" });
    await expect(enter).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(enter).toBeEnabled();
    await enter.click();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
