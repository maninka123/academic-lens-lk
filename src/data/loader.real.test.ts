import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { loadDataset } from "./loader";

// Loads the generated public data exactly as the browser does, so a change to the
// importer's columns can never ship a site that cannot start.
it("loads the real generated dataset", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    const name = String(url).split("/data/")[1].split("?")[0];
    try {
      return new Response(readFileSync("public/data/" + name, "utf8"), { status: 200 });
    } catch {
      return new Response("", { status: 404 });
    }
  });
  const data = await loadDataset();
  expect(data.academics.length).toBeGreaterThan(2000);
  expect(new Set(data.academics.map((a) => a.id)).size).toBe(data.academics.length);
  expect(data.universities.length).toBeGreaterThanOrEqual(15);
  for (const a of data.academics) {
    for (const k of ["publications", "citations", "recentCitations", "hIndex"] as const) {
      const v = a[k];
      expect(v === null || (Number.isFinite(v) && v >= 0)).toBe(true);
    }
    // an h-index above the publication count, or citations with h = 0, is impossible
    if (a.hIndex !== null && a.publications !== null) expect(a.hIndex).toBeLessThanOrEqual(a.publications);
    if (a.citations !== null && a.citations > 0 && a.hIndex !== null) expect(a.hIndex).toBeGreaterThan(0);
  }
  vi.unstubAllGlobals();
});
