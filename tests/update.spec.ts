import { test, expect } from "@playwright/test";
test("updated records, aliases, column filters and automatic portrait", async ({
  page,
}) => {
  await page.goto("./#/academics");
  await expect(
    page.getByText("1,393 matching profiles", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Filter University", { exact: true }).fill("Kelaniya");
  await page.getByLabel("Minimum Citations", { exact: true }).fill("100");
  const names = page.locator("tbody .academic-name");
  await expect(names.first()).toBeVisible();
  expect(await names.count()).toBeGreaterThan(0);
  await names.first().click();
  await expect(
    page.getByRole("combobox", { name: "Illustration style" }),
  ).toHaveCount(0);
  await page.goto("./#/academics/SL-7ac948df90b8");
  await expect(page).toHaveURL(/SL-dd58210d266c$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dr ");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("*");
});
test("comparison presets, dropdown arrows and compact origins", async ({
  page,
}) => {
  await page.goto("./#/compare");
  await page.getByRole("button", { name: "Compare typical citations" }).click();
  await expect(page.getByLabel("Aggregation", { exact: true })).toHaveValue(
    "median",
  );
  expect(
    await page
      .getByLabel("Chart type")
      .evaluate((el) => getComputedStyle(el).backgroundPosition),
  ).toContain("12px");
  await page.screenshot({
    path: "output/playwright/new-compare-desktop.png",
    fullPage: true,
  });
  await page.goto("./#/origins");
  await expect(
    page.getByRole("heading", { name: "PhD Origins", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/new-origins-desktop.png",
    fullPage: true,
  });
  await page.goto("./#/");
  await expect(
    page.getByRole("list", { name: "Academic position legend" }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/new-overview-desktop.png",
    fullPage: true,
  });
});
