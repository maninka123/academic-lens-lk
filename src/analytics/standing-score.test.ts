import { describe, expect, it } from "vitest";
import type { Academic } from "../types";
import { bandOf, standingScore } from "./standing-score";

let n = 0;
const make = (over: Partial<Academic> = {}): Academic =>
  ({
    id: "p" + n++, name: "P", rank: "Senior Lecturer", field: "Engineering",
    hIndex: null, recentCitations: null, publications: null,
    citations: null, q1: null, recentQ1: null, metricsSource: "Google Scholar",
    metricEvidence: [], ...over,
  }) as Academic;
const group = (count: number, field = "Engineering", rank = "Senior Lecturer") =>
  Array.from({ length: count }, (_, i) =>
    make({ field, rank, hIndex: i + 1, recentCitations: (i + 1) * 10, publications: (i + 1) * 5 }));

describe("standing score", () => {
  it("blends midrank percentiles with the stated weights", () => {
    const peers = group(20);
    const top = peers[19];
    const r = standingScore(top, peers);
    expect(r.level).toBe("discipline-stage");
    expect(r.measuresUsed).toBe(3);
    expect(r.components.every((c) => c.percentile === 97.5)).toBe(true);
    expect(r.score).toBe(98);
    expect(r.band).toBe("Upper");
    expect(r.groupSize).toBe(20);
  });
  it("skips missing measures and rescales weights; zero is a real value", () => {
    const peers = group(20);
    const person = make({ hIndex: 0, recentCitations: null, publications: 0 });
    const r = standingScore(person, [...peers, person]);
    expect(r.components.find((c) => c.metric === "recentCitations")!.status).toBe("missing");
    expect(r.measuresUsed).toBe(2);
    expect(r.weightUsed).toBeCloseTo(0.65);
    expect(r.score).toBe(2);
  });
  it("builds an indicative score from one measure and says so", () => {
    const peers = group(20);
    const single = make({ hIndex: 15 });
    const r = standingScore(single, [...peers, single]);
    expect(r.score).not.toBeNull();
    expect(r.basis).toBe("indicative");
    expect(r.confidence).toBe("low");
    expect(r.measuresUsed).toBe(1);
    expect(r.caveats.join(" ")).toMatch(/Only one measure/);
    const pubsOnly = make({ publications: 50 });
    const p = standingScore(pubsOnly, [...peers, pubsOnly]);
    expect(p.basis).toBe("indicative");
    expect(p.caveats.join(" ")).toMatch(/No impact measure/);
  });
  it("accepts peer groups of 5-9 only as an indicative fallback", () => {
    const small = group(7, "Law");
    const person = make({ field: "Law", hIndex: 4, recentCitations: 40, publications: 20 });
    const r = standingScore(person, [...small, person, ...group(30, "Engineering")]);
    // Law has 8 people (<10) so the standard pass falls to stage; that is still standard.
    expect(r.basis).toBe("standard");
    expect(r.level).toBe("stage");
    const tiny = group(7);
    const lone = make({ hIndex: 4, recentCitations: 40, publications: 20 });
    const rr = standingScore(lone, [...tiny, lone]);
    expect(rr.basis).toBe("indicative");
    expect(rr.caveats.join(" ")).toMatch(/5\+ accepted/);
  });
  it("compares across stages, flagged, when the position is not recognised", () => {
    const person = make({ rank: "Instructor", hIndex: 5, recentCitations: 50, publications: 25 });
    const r = standingScore(person, [...group(20), ...group(12, "Engineering", "Professor"), person]);
    expect(r.score).not.toBeNull();
    expect(r.basis).toBe("indicative");
    expect(r.level).toBe("discipline");
    expect(r.confidence).toBe("low");
    expect(r.caveats.join(" ")).toMatch(/Career stage not recognised/);
  });
  it("pools other sources, flagged, when a person's own source has no peers", () => {
    const scholar = group(15);
    const openAlexPerson = make({
      hIndex: 12, recentCitations: 120, publications: 60, metricsSource: "OpenAlex",
    });
    const r = standingScore(openAlexPerson, [...scholar, openAlexPerson]);
    expect(r.score).not.toBeNull();
    expect(r.basis).toBe("indicative");
    expect(r.caveats.join(" ")).toMatch(/other sources/);
  });
  it("does not score anyone with no research measure at all", () => {
    const person = make({ hIndex: null, recentCitations: null, publications: null });
    const r = standingScore(person, [...group(20), person]);
    expect(r.score).toBeNull();
    expect(r.basis).toBe("none");
    expect(r.reason).toMatch(/nothing to compare/);
  });
  it("labels bands at their boundaries", () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(bandOf)).toEqual([
      "Lower", "Lower", "Low-Mid", "Low-Mid",
      "Middle", "Middle", "High-Mid", "High-Mid",
      "Upper", "Upper",
    ]);
  });
});
