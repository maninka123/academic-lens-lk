import { describe, it, expect } from "vitest";
import { tierDifference, matchedField } from "./international";

describe("tierDifference", () => {
  it("is the tier median divided by the Sri Lankan median when Sri Lanka is lower", () => {
    expect(tierDifference(2, 11)).toMatchObject({ value: "5.5×", word: "lower", kind: "lower", ratio: 5.5 });
    expect(tierDifference(2, 16.5)).toMatchObject({ value: "8.25×", word: "lower" });
    expect(tierDifference(2, 21)).toMatchObject({ value: "10.5×", word: "lower" });
  });
  it("is the Sri Lankan median divided by the tier median when Sri Lanka is higher", () => {
    expect(tierDifference(15, 10)).toMatchObject({ value: "1.5×", word: "higher", kind: "higher" });
    expect(tierDifference(30, 10)).toMatchObject({ value: "3×", word: "higher" });
  });
  it("handles equal values, zero medians and missing data without dividing by zero", () => {
    expect(tierDifference(7, 7)).toMatchObject({ kind: "same", value: "1×" });
    expect(tierDifference(0, 0)).toMatchObject({ kind: "same" });
    expect(tierDifference(0, 5)).toMatchObject({ kind: "none", reason: "sri-zero", ratio: 0 });
    expect(tierDifference(3, 0)).toMatchObject({ kind: "none", reason: "zero", ratio: 0 });
    expect(tierDifference(null, 10)).toMatchObject({ kind: "none", reason: "missing" });
    expect(tierDifference(4, null)).toMatchObject({ kind: "none", reason: "missing" });
  });
  it("does not show a real difference as 1×", () => {
    expect(tierDifference(10, 10.01).value).toBe("<1.01×");
  });
});

describe("matchedField medicine", () => {
  it("benchmarks only medical faculties as Medicine, not allied health or nursing", () => {
    expect(matchedField({ faculty: "Faculty of Medicine", department: "Department of Community Medicine" })).toBe("Medicine");
    expect(matchedField({ faculty: "Faculty of Allied Health Sciences", department: "Department of Medical Laboratory Sciences" })).toBe("");
    expect(matchedField({ faculty: "Faculty of Health Sciences", department: "Department of Nursing" })).toBe("");
  });
});
