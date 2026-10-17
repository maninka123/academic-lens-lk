import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DataContext } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import type { Academic, Dataset } from "../types";
import { Institution } from "./Academics";

vi.mock("../components/Chart", () => ({ Chart: () => <div data-testid="chart" /> }));
vi.mock("../components/AcademicTable", () => ({ AcademicTable: ({ rows }: { rows: Academic[] }) => <div>{rows.map(a => <span key={a.id}>{a.name}</span>)}</div> }));
afterEach(() => { cleanup(); useAtlas.setState({ filters: emptyFilters() }); });

it("shows collected institution profiles independently of saved comparison filters", () => {
  useAtlas.setState({ filters: { ...emptyFilters(), universities: ["sliit"], qualifications: ["PhD"] } });
  const academic = {
    id: "person", name: "CINEC lecturer", universityId: "cinec", university: "CINEC Campus",
    facultyId: "", departmentId: "", type: "Non-state", position: "Lecturer", rank: "Lecturer",
    qualifications: "", qualification: "Unknown", doctorateStatus: "unknown", field: "Business",
    publications: null, citations: null, recentCitations: null, hIndex: null, q1: null, recentQ1: null,
  } as Academic;
  const data = { academics: [academic], universities: [{ id: "cinec", name: "CINEC Campus", type: "Non-state" }],
    coverage: [], metadata: { minimumSample: 10, window: [2021, 2025] } } as unknown as Dataset;
  render(<MemoryRouter initialEntries={["/university/cinec"]}><DataContext.Provider value={data}>
    <Routes><Route path="/university/:id" element={<Institution />} /></Routes>
  </DataContext.Provider></MemoryRouter>);
  expect(screen.getByText("Collected records").parentElement).toHaveTextContent("1");
  expect(screen.getByText("CINEC lecturer")).toBeInTheDocument();
  expect(useAtlas.getState().filters.universities).toEqual(["sliit"]);
});
