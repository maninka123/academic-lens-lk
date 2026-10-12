import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataContext } from "../data/context";
import { useAtlas, emptyFilters } from "../store";
import type { Academic, Dataset } from "../types";
import { Overview } from "./Overview";

vi.mock("../components/Chart", () => ({ Chart: () => null }));
vi.mock("./Global", () => ({ GlobalTeaser: () => null }));
afterEach(() => { cleanup(); useAtlas.setState({ filters: emptyFilters() }); });

it("shows the complete overview while preserving a saved comparison institution filter", () => {
  useAtlas.setState({ filters: { ...emptyFilters(), universities: ["sliit"] } });
  const academics = ["sliit", "colombo"].map((universityId, i) => ({
    id: String(i), universityId, university: universityId, rank: "Lecturer",
    type: "Public", qualification: "Unknown", doctorateStatus: "unknown",
    facultyId: "", departmentId: "", publications: null, citations: null,
    recentCitations: null, hIndex: null,
  } as Academic));
  const data = {
    academics,
    universities: academics.map(a => ({ id: a.universityId, name: a.university, short: a.university, type: "Public" })),
  } as unknown as Dataset;
  render(<MemoryRouter><DataContext.Provider value={data}><Overview /></DataContext.Provider></MemoryRouter>);
  expect(screen.getByText("2 of 2")).toBeInTheDocument();
  expect(screen.getByText("Academics collected").parentElement).toHaveTextContent("2");
  expect(useAtlas.getState().filters.universities).toEqual(["sliit"]);
});
