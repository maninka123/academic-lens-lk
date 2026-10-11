import type { Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import Papa from "papaparse";
/** Test-only HTTP fixtures. There is no dataset-switching UI or production path. */
export async function useSyntheticFixture(page: Page) {
  await page.route("**/data/*", async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!;
    if (file === "world.geo.json") return route.continue();
    if (file === "field-mapping.json") {
      const rows = Papa.parse<any>(
        readFileSync("tests/fixtures/academics.csv", "utf8"),
        { header: true, skipEmptyLines: true },
      ).data;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          departments: {},
          faculties: Object.fromEntries(
            rows.map((r) => [r.facultyId, r.field]),
          ),
        }),
      });
    }
    const path = "tests/fixtures/" + file;
    if (!existsSync(path)) return route.continue();
    let body = readFileSync(path, "utf8");
    if (file === "metadata.json")
      body = JSON.stringify({ ...JSON.parse(body), mode: "real" });
    await route.fulfill({
      contentType: file.endsWith(".json") ? "application/json" : "text/csv",
      body,
    });
  });
}
