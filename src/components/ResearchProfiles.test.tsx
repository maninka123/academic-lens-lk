import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Academic } from "../types";
import { ResearchProfiles } from "./ResearchProfiles";

afterEach(cleanup);
it("shows a saved OpenAlex author source alongside other research profiles", () => {
  render(<ResearchProfiles academic={{ openAlexUrl: "https://openalex.org/A123", openAlexStatus: "openalex_matched_name_and_institution" } as Academic} />);
  expect(screen.getByRole("link", { name: "OpenAlex" })).toHaveAttribute("href", "https://openalex.org/A123");
});
it("labels recorded research platforms, including a ResearchGate metrics source", () => {
  render(
    <ResearchProfiles
      academic={
        {
          scholarUrl: "https://scholar.google.com/citations?user=abc",
          metricsUrl: "https://www.researchgate.net/profile/Example",
        } as Academic
      }
    />,
  );
  expect(screen.getByRole("link", { name: "Google Scholar" })).toHaveAttribute(
    "href",
    "https://scholar.google.com/citations?user=abc",
  );
  expect(screen.getByRole("link", { name: "ResearchGate" })).toHaveAttribute(
    "href",
    "https://www.researchgate.net/profile/Example",
  );
});
it("does not fabricate profile links or accept a misleading platform hostname", () => {
  render(
    <ResearchProfiles
      academic={
        {
          scholarUrl: "javascript:alert(1)",
          researchgateUrl:
            "https://researchgate.net.example.com/profile/Example",
        } as Academic
      }
    />,
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Google Scholar")).toHaveTextContent("Not recorded");
  expect(screen.getByText("ResearchGate")).toHaveTextContent("Not recorded");
});
