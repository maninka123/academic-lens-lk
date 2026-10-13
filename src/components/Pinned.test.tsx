import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { Pinned } from "./Pinned";
import { AcademicTable } from "./AcademicTable";
import { useAtlas, emptyFilters, defaultConfig } from "../store";
import { DataContext } from "../data/context";
import type { Academic, Dataset } from "../types";
const rows = Array.from({ length: 16 }, (_, i) => ({
  id: "a" + i,
  name: "Academic " + i,
  universityId: i < 8 ? "a" : "b",
  university: i < 8 ? "University A" : "University B",
  facultyId: "f",
  faculty: "Engineering",
  departmentId: "d",
  department: "Civil",
  type: i < 8 ? "Public" : "Non-state",
  rank: i % 2 ? "Professor" : "Senior Lecturer",
  qualification: "Unknown",
  citations: i * 100,
  publications: i * 10,
  experience: i,
  field: "Engineering",
  phdCountry: "",
  interests: "",
  position: "",
  qualifications: "",
  phdUniversity: "",
  phdYear: null,
  phdStatus: "",
  recentCitations: null,
  hIndex: null,
  q1: null,
  recentQ1: null,
  sourceUrl: "",
  scholarUrl: "",
  metricsUrl: "",
  metricsSource: "",
  collectionDate: "",
  snapshotDate: "",
  status: "",
  employmentStatus: "",
  notes: "",
})) as Academic[];
const d = {
  academics: rows,
  universities: [],
  coverage: [],
  summary: null,
  metadata: {
    version: "test",
    mode: "demo",
    collectionDate: "",
    window: [2021, 2025],
    description: "",
    q1Methodology: "",
    limitations: [],
    scopeNote: "",
  },
} as Dataset;
const wrapper = ({ children }: any) => (
  <HashRouter>
    <DataContext.Provider value={d}>{children}</DataContext.Provider>
  </HashRouter>
);
beforeEach(() => {
  cleanup();
  useAtlas.setState({
    filters: emptyFilters(),
    config: defaultConfig,
    pinned: [],
    custom: [],
  });
});
describe("academic selection", () => {
  it("adds a batch of people and keeps the search available for more", () => {
    render(<Pinned />, { wrapper });
    fireEvent.change(screen.getByLabelText("Add Academic"), { target: { value: "Academic" } });
    fireEvent.click(screen.getByRole("button", { name: "Add all 12 shown" }));
    expect(useAtlas.getState().pinned).toHaveLength(12);
    expect(screen.getByLabelText("Add Academic")).toHaveValue("Academic");
    fireEvent.click(screen.getByRole("button", { name: "Add all 4 shown" }));
    expect(useAtlas.getState().pinned).toHaveLength(16);
  });
  it("pins, recalculates peers, retains pins across chart changes, and removes", () => {
    render(<Pinned />, { wrapper });
    fireEvent.change(screen.getByLabelText("Add Academic"), {
      target: { value: "Academic 0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Academic 0/ }));
    expect(useAtlas.getState().pinned).toEqual(["a0"]);
    expect(screen.getByText("Included in peer group")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Peer group"), {
      target: { value: "rank" },
    });
    expect(screen.getByText("8")).toBeInTheDocument();
    useAtlas.getState().configure({ chart: "scatter" });
    expect(useAtlas.getState().pinned).toEqual(["a0"]);
    fireEvent.click(screen.getByLabelText("Remove Academic 0"));
    expect(useAtlas.getState().pinned).toEqual([]);
  });
  it("supports at least 10 distinct pinned people", () => {
    for (let i = 0; i < 12; i++) useAtlas.getState().pin("a" + i);
    useAtlas.getState().pin("a0");
    expect(useAtlas.getState().pinned).toHaveLength(12);
  });
  it("shows external reference after filtering", () => {
    useAtlas.setState({
      pinned: ["a0"],
      filters: { ...emptyFilters(), universities: ["b"] },
    });
    render(<Pinned />, { wrapper });
    expect(screen.getByText("External reference")).toBeInTheDocument();
    expect(screen.getAllByText("1,150")).toHaveLength(2);
  });
  it("directory pagination and pin actions work", () => {
    render(<AcademicTable rows={rows} />, { wrapper });
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Academic 1");
    fireEvent.click(screen.getByLabelText("Pin Academic 0"));
    expect(useAtlas.getState().pinned).toEqual(["a0"]);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Senior Lecturer", { selector: "td" })).toBeInTheDocument();
  });
});
