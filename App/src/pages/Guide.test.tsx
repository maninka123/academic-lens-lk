import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Guide } from "./Guide";
import guideSource from "../../docs/HOW_TO_INTERPRET_DATA.md?raw";

afterEach(cleanup);

describe("interpretation guide", () => {
  it("renders the guide with its examples, what they mean and what they do not", () => {
    const { container } = render(
      <MemoryRouter>
        <Guide />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /how to interpret the data/i })).toBeTruthy();
    expect(container.querySelectorAll("figure.guide-figure img").length).toBe(3);
    expect(container.querySelectorAll("li.guide-means").length).toBe(3);
    expect(container.querySelectorAll("li.guide-not").length).toBe(3);
    expect(container.querySelectorAll("li.guide-do").length).toBe(3);
  });
  it("covers the required points, including appropriate use, no decisions and verification", () => {
    for (const phrase of [
      "Appropriate use and limits",
      "Verify and validate before any use",
      "Missing is not zero",
      "Corrections and removal",
      "Our position on accuracy",
    ])
      expect(guideSource).toContain(phrase);
    expect(guideSource).toMatch(/comparisons do not show\*\* that one academic is better, more capable or more professionally suitable/i);
    expect(guideSource).toMatch(/not designed or validated for recruitment, promotion, funding, disciplinary/i);
    expect(guideSource).toMatch(/removal needs no reason/i);
  });
});
