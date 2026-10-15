import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataContext } from "../data/context";
import { useAtlas, emptyFilters, defaultConfig } from "../store";
import type { Academic, Dataset } from "../types";
import { Compare } from "./Compare";

vi.mock("../components/Chart", () => ({
  Chart: ({ option, onClick }: any) => <button onClick={() => onClick({ data: option.series[0].data[0] })}>Inspect first bar</button>,
}));
const rows = Array.from({ length: 20 }, (_, i) => ({
  id: "a" + i, name: "Academic " + i, universityId: "u", university: "University",
  facultyId: "u--f", faculty: "Faculty", departmentId: "u--f--d", department: "Department",
  rank: "Lecturer", position: "Lecturer", type: "Public", qualification: "Unknown", doctorateStatus: "unknown",
  publications: null, citations: null, recentCitations: null, hIndex: i + 5, q1: null, recentQ1: null,
  metricEvidence: [{ metric: "hIndex", value: i + 5, source: i === 19 ? "ResearchGate" : "Google Scholar", url: "https://example.com", date: "2026-10-13" }],
  interests: "", qualifications: "", phdCountry: "", phdStatus: "", collectionDate: "2026-10-13",
})) as Academic[];
const data = { academics: rows, universities: [], metadata: { window: [2021, 2025], minimumSample: 10, version: "test" } } as unknown as Dataset;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  useAtlas.setState({ config: { ...defaultConfig, metric: "hIndex" }, pinned: ["a0", "a19"], filters: emptyFilters(), custom: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens a bar-details popup while preserving the current comparison", () => {
  render(<MemoryRouter><DataContext.Provider value={data}><Compare /></DataContext.Provider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Inspect first bar" }));
  expect(screen.getByRole("dialog", { name: "University" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Explore this group" })).toBeInTheDocument();
  expect(useAtlas.getState().config.level).toBe("university");
  expect(useAtlas.getState().filters.universities).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Explore this group" }));
  expect(useAtlas.getState().config.level).toBe("faculty");
  expect(useAtlas.getState().filters.universities).toEqual(["u"]);
});
it("uses the selected provider for both pinned values and plot references", () => {
  render(<MemoryRouter><DataContext.Provider value={data}><Compare /></DataContext.Provider></MemoryRouter>);
  expect(screen.getByText(/ResearchGate value, not Google Scholar/)).toBeInTheDocument();
  expect(screen.getAllByText("ResearchGate").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Comparison setup")).toBeInTheDocument();
});
