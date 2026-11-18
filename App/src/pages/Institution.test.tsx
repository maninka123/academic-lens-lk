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

it("shows UCSC and Sri Palee Campus under Campuses & Schools, apart from the faculties", () => {
  const person = (id: string, facultyId: string, faculty: string) => ({
    id, name: id, universityId: "colombo", university: "University of Colombo", facultyId, faculty, departmentId: "", department: "",
    type: "Public", position: "Lecturer", rank: "Lecturer", qualifications: "", qualification: "Unknown", doctorateStatus: "unknown", field: "Unmapped",
    publications: null, citations: null, recentCitations: null, hIndex: null, q1: null, recentQ1: null,
  }) as unknown as Academic;
  const data = {
    academics: [person("a", "colombo--faculty-of-arts", "Faculty of Arts")],
    universities: [{ id: "colombo", name: "University of Colombo", type: "Public" }],
    orgUnits: [
      { id: "colombo--university-of-colombo-school-of-computing-ucsc", universityId: "colombo", name: "University of Colombo School of Computing (UCSC)", category: "campus_school" },
      { id: "colombo--sri-palee-campus-spc", universityId: "colombo", name: "Sri Palee Campus (SPC)", category: "campus_school" },
    ],
    coverage: [], metadata: { minimumSample: 10, window: [2021, 2025] },
  } as unknown as Dataset;
  render(<MemoryRouter initialEntries={["/university/colombo"]}><DataContext.Provider value={data}>
    <Routes><Route path="/university/:id" element={<Institution />} /><Route path="/university/:id/faculty/:faculty" element={<Institution />} /></Routes>
  </DataContext.Provider></MemoryRouter>);
  const faculties = screen.getByText("Faculties / schools").closest("section")!;
  const campuses = screen.getByText("Campuses & Schools").closest("section")!;
  expect(faculties).toHaveTextContent("Faculty of Arts");
  expect(faculties).not.toHaveTextContent("UCSC");
  expect(campuses).toHaveTextContent("University of Colombo School of Computing (UCSC)");
  expect(campuses).toHaveTextContent("Sri Palee Campus (SPC)");
  expect(campuses).toHaveTextContent("No collected profiles yet");
  expect(campuses).not.toHaveTextContent("Faculty of Arts");
});

it("opens a registered campus or school with no staff yet instead of reporting it missing", () => {
  const data = {
    academics: [], universities: [{ id: "colombo", name: "University of Colombo", type: "Public" }],
    orgUnits: [{ id: "colombo--sri-palee-campus-spc", universityId: "colombo", name: "Sri Palee Campus (SPC)", category: "campus_school" }],
    coverage: [], metadata: { minimumSample: 10, window: [2021, 2025] },
  } as unknown as Dataset;
  render(<MemoryRouter initialEntries={["/university/colombo/faculty/colombo--sri-palee-campus-spc"]}><DataContext.Provider value={data}>
    <Routes><Route path="/university/:id/faculty/:faculty" element={<Institution />} /></Routes>
  </DataContext.Provider></MemoryRouter>);
  expect(screen.queryByText("Unit not found")).not.toBeInTheDocument();
  expect(screen.getAllByText("Sri Palee Campus (SPC)").length).toBeGreaterThan(0);
  expect(screen.getByText("No collected profiles")).toBeInTheDocument();
});

