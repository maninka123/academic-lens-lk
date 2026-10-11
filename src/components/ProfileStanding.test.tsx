import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from "@testing-library/react";
import type { Academic } from "../types";
import { ProfileStanding } from "./ProfileStanding";
vi.mock("./Chart", () => ({
  Chart: ({ label }: { label: string }) => (
    <div role="img" aria-label={label} />
  ),
}));
afterEach(cleanup);
const make = (
  id: string,
  citations: number | null,
  extra: Partial<Academic> = {},
) =>
  ({
    id,
    name: id,
    universityId: "u",
    facultyId: "f",
    departmentId: "d",
    rank: "Lecturer",
    position: "Lecturer",
    qualification: "PhD",
    field: "Science",
    type: "Public",
    citations,
    ...extra,
  }) as Academic;
const target = make("person", 4);
const rows = [
  target,
  make("b", 0),
  make("c", 2),
  make("d", 6),
  make("e", 8),
  make("f", 10),
  make("other-role", 100, { rank: "Professor" }),
  make("other-qualification", 20, { qualification: "Masters" }),
  make("other-institution", 900, { universityId: "v" }),
  make("missing", null),
];
const cells = () => {
  const toggle = screen.getByText("Detailed statistics");
  if (!toggle.parentElement?.hasAttribute("open")) fireEvent.click(toggle);
  return within(screen.getByRole("row", { name: /^Department / }))
    .getAllByRole("cell")
    .map((c) => c.textContent);
};
describe("individual hierarchical standing", () => {
  it("keeps position peers inside the institution and applies qualification cohorts at every level", () => {
    render(<ProfileStanding academic={target} rows={rows} />);
    expect(cells().slice(0, 5)).toEqual(["8", "7", "4", "—", "—"]);
    fireEvent.change(screen.getByLabelText("Compare with"), {
      target: { value: "both" },
    });
    expect(cells().slice(0, 5)).toEqual(["7", "6", "4", "—", "—"]);
    expect(cells().at(-1)).toBe("—");
    fireEvent.change(screen.getByLabelText("Compare with"), {
      target: { value: "phd" },
    });
    expect(cells().slice(0, 2)).toEqual(["8", "7"]);
  });
  it("does not invent membership or percentiles when identity or measurement is missing", () => {
    render(
      <ProfileStanding
        academic={{ ...target, departmentId: "", citations: null }}
        rows={rows}
      />,
    );
    expect(
      screen.queryByRole("row", { name: /^Department / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^Department$/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Detailed statistics"));
    expect(
      within(screen.getByRole("row", { name: /^Faculty/ }))
        .getAllByRole("cell")
        .at(-1)?.textContent,
    ).toBe("—");
    expect(screen.getByText(/No citations value is recorded/)).toBeVisible();
  });
});
