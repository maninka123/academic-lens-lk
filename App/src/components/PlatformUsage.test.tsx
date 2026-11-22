import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformUsage } from "./PlatformUsage";
import { parseUsage, summarizeUsage } from "../analytics/usage";
// The real export pipeline: private rows -> private export -> public aggregate, exactly as `scripts/usage-export.mjs` writes it.
// @ts-expect-error plain JavaScript script without type declarations
import { buildPrivateExport, buildPublicUsage } from "../../scripts/usage-export.mjs";

const charts: any[] = [];
vi.mock("./Chart", () => ({ Chart: (p: any) => (charts.push(p), <div role="img" aria-label={p.label} />) }));

const rows = [
  { date: "2026-12-01", country: "Sri Lanka", referrer: "google.com", visits: 10, pageViews: 25 },
  { date: "2026-12-01", country: "Australia", referrer: "", visits: 2, pageViews: 3 },
  { date: "2026-12-03", country: "Sri Lanka", referrer: "", visits: 6, pageViews: 9 },
];
const published = buildPublicUsage(buildPrivateExport(rows, { periodStart: "2026-12-01", periodEnd: "2026-12-04", exportedAt: "2026-12-05T00:00:00.000Z" }), "2026-12-05");
const serve = (body: unknown, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
afterEach(() => {
  cleanup();
  charts.length = 0;
  vi.unstubAllGlobals();
});

describe("website analytics data", () => {
  it("accepts the file the export script writes", () => {
    expect(parseUsage(published)).not.toBeNull();
    expect(published.visits).toBe(18);
    expect(published.pageViews).toBe(37);
    expect(published.daily).toEqual([
      { date: "2026-12-01", visits: 12, pageViews: 28 },
      { date: "2026-12-03", visits: 6, pageViews: 9 },
    ]);
  });
  it("calculates derived statistics from the real values", () => {
    const s = summarizeUsage(parseUsage(published)!);
    expect(s.days).toBe(4); // 1 to 4 December, both ends included
    expect(s.pageViewsPerVisit).toBeCloseTo(37 / 18, 10);
    expect(s.avgDailyVisits).toBe(18 / 4);
  });
  it("leaves days without a reported value as gaps, never zero", () => {
    const s = summarizeUsage(parseUsage(published)!);
    expect(s.series.map((d) => d.date)).toEqual(["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
    expect(s.series[1]).toEqual({ date: "2026-12-02", visits: null, pageViews: null });
    expect(s.series[3].visits).toBeNull();
  });
  it("does not divide by zero visits", () => {
    const none = parseUsage({ ...published, visits: 0, pageViews: 0, daily: [] })!;
    expect(summarizeUsage(none).pageViewsPerVisit).toBeNull();
    expect(summarizeUsage(none).avgDailyVisits).toBe(0);
  });
  it("counts a single-day period as one calendar day", () => {
    const one = parseUsage({ ...published, periodStart: "2026-12-01", periodEnd: "2026-12-01", visits: 12, pageViews: 28, daily: [published.daily[0]] })!;
    expect(summarizeUsage(one).days).toBe(1);
    expect(summarizeUsage(one).avgDailyVisits).toBe(12);
  });
  it("rejects anything beyond the approved aggregates", () => {
    expect(parseUsage({ ...published, byCountry: { LK: 1 } })).toBeNull();
    expect(parseUsage({ ...published, uniqueVisitors: 5 })).toBeNull();
    expect(parseUsage({ ...published, daily: [{ ...published.daily[0], path: "/x" }, published.daily[1]] })).toBeNull();
    expect(parseUsage({ ...published, daily: [{ date: "2026-12-01", pageViews: 28 }, published.daily[1]] })).toBeNull();
    expect(parseUsage({ ...published, visits: 19 })).toBeNull();
  });
});

describe("Website Analytics card", () => {
  it("shows the four KPIs, the daily chart, the period, the source and the update date from the exported file", async () => {
    serve(published);
    render(<PlatformUsage />);
    await waitFor(() => expect(screen.getByText("Total visits")).toBeTruthy());
    const kpi = (label: string) => screen.getByText(label, { selector: "dt" }).parentElement!.querySelector("dd")!.textContent;
    expect(kpi("Total visits")).toBe("18");
    expect(kpi("Total page views")).toBe("37");
    expect(kpi("Page views per visit")).toBe("2.06");
    expect(kpi("Average daily visits")).toBe("4.5");
    expect(screen.getByRole("img", { name: "Daily visits and page views" })).toBeTruthy();
    const series = charts[0].option.series;
    expect(series.map((s: any) => s.name)).toEqual(["Page views", "Visits"]);
    expect(series[0].data).toEqual([28, null, 9, null]);
    expect(series[1].data).toEqual([12, null, 6, null]);
    expect(document.body.textContent).toMatch(/Reporting period 1 Dec 2026 to 4 Dec 2026 \| Last updated 5 Dec 2026/);
    expect(document.body.textContent).toMatch(/Source: Cloudflare Web Analytics \| Usage statistics are approximate\./);
  });
  it("shows a compact unavailable state, with no numbers, before anything is exported", async () => {
    serve({}, false);
    render(<PlatformUsage />);
    expect(screen.getByRole("status").textContent).toBe("Analytics data not yet available");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText("Total visits")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.body.textContent).toMatch(/Source: Cloudflare Web Analytics \| Usage statistics are approximate\./);
  });
  it("links the Privacy Notice to the page that works on the live site, and shows no country, referral or profile data", async () => {
    serve(published);
    render(<PlatformUsage />);
    await waitFor(() => expect(screen.getByText("Total visits")).toBeTruthy());
    expect((screen.getByRole("link", { name: "Privacy Notice" }) as HTMLAnchorElement).href).toBe("https://github.com/maninka123/academic-lens-lk/blob/main/App/docs/legal/PRIVACY.md");
    expect(document.body.textContent).not.toMatch(/Sri Lanka|google|Australia|countr|referr|profile/i);
  });
  it("ignores an invalid file and shows the unavailable state", async () => {
    serve({ ...published, byCountry: { LK: 1 } });
    render(<PlatformUsage />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole("status").textContent).toBe("Analytics data not yet available");
  });
});
