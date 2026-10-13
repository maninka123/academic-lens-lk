import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Academic } from "../types";
import { ProfileStanding } from "./ProfileStanding";
vi.mock("./Chart", () => ({
  Chart: ({ option, label }: any) => (
    <div
      role="img"
      aria-label={label}
      data-points={JSON.stringify(
        option.series.map((s: any) => ({ name: s.name, data: s.data })),
      )}
    />
  ),
}));
afterEach(cleanup);
const rows = Array.from(
  { length: 12 },
  (_, i) =>
    ({
      id: String(i),
      name: "Person " + i,
      universityId: "u",
      university: "University",
      facultyId: "f",
      faculty: "Science",
      departmentId: "d",
      department: "Physics",
      rank: "Professor",
      position: "Professor",
      qualification: "PhD",
      type: "Public",
      field: "Natural sciences",
      metricsSource: "Google Scholar",
      citations: i === 11 ? null : i * 100,
      publications: i === 10 ? null : i * 10,
      hIndex: i,
      q1: null,
      recentQ1: null,
      recentCitations: null,
    }) as Academic,
);
it("switches to a distribution and highlights the person without duplicating them", () => {
  render(
    <MemoryRouter>
      <ProfileStanding academic={rows[0]} rows={rows} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Peer chart view"), {
    target: { value: "distribution" },
  });
  const plot = screen.getByRole("img", { name: /Value distribution/ });
  const series = JSON.parse(plot.getAttribute("data-points")!);
  expect(series[0].data).toHaveLength(10);
  expect(series[1].data).toHaveLength(1);
  expect(series[1].data[0].rawY).toBe(0);
  expect(screen.getByText(/Vertical spacing separates/)).toBeInTheDocument();
});
it("uses paired same-source values for scatter and explains missing personal values", () => {
  render(
    <MemoryRouter>
      <ProfileStanding academic={rows[10]} rows={rows} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Peer chart view"), {
    target: { value: "scatter" },
  });
  expect(screen.getByLabelText("Peer horizontal measurement")).toHaveValue(
    "hIndex",
  );
  const initial = screen.getByRole("img", { name: /Scatter plot/ });
  expect(JSON.parse(initial.getAttribute("data-points")!)[1].data).toHaveLength(
    1,
  );
  fireEvent.change(screen.getByLabelText("Peer horizontal measurement"), {
    target: { value: "publications" },
  });
  const plot = screen.getByRole("img", { name: /Scatter plot/ });
  const series = JSON.parse(plot.getAttribute("data-points")!);
  expect(series[0].data).toHaveLength(10);
  expect(series[1].data).toHaveLength(0);
  expect(
    screen.getByText(/This person has no comparable value/),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Peer horizontal measurement"),
  ).toBeInTheDocument();
});
it("exposes cohort definitions and the contributing profiles", () => {
  render(
    <MemoryRouter>
      <ProfileStanding academic={rows[0]} rows={rows} />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("What do “peer” and “same” mean?"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/^A peer is a collected profile/, {
      selector: "p",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Profiles behind the selected result (11 with values)"),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Person 0" })).toHaveAttribute(
    "href",
    "/academics/0",
  );
});
