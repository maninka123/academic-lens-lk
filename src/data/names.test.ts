import { expect, it } from "vitest";
import { academicDisplayName } from "./names";
const name = (n: string, qualification = "Unknown", phdStatus = "unknown") =>
  academicDisplayName({
    name: n,
    qualification,
    phdStatus,
    qualifications: qualification,
  });
it("uses research doctorate evidence rather than source medical or professorial titles", () => {
  expect(name("Prof. (Mrs.) A. Perera", "PhD", "completed")).toBe(
    "Dr A. Perera*",
  );
  expect(name("Ms. A. Perera", "PhD", "in_progress")).toBe("Ms A. Perera");
  expect(
    name("Chair Professor (Dr.) Lalith Edirisinghe", "PhD", "completed"),
  ).toBe("Dr Lalith Edirisinghe*");
});
it("never infers an honorific or gender that the source does not state", () => {
  expect(name("Dr. S. Silva", "MBBS")).toBe("S. Silva");
  expect(name("Drashti Perera")).toBe("Drashti Perera");
  expect(name("Mr. K. Fernando")).toBe("Mr K. Fernando");
  expect(name("Miss R. Dias")).toBe("Miss R. Dias");
});
it("does not award Dr for contradictory or in-progress doctorate evidence", () => {
  expect(
    academicDisplayName({
      name: "Dr. A. Bandara",
      qualification: "PhD",
      phdStatus: "listed_completed",
      qualifications: "PhD (Reading)",
      doctorateStatus: "contradictory",
    }),
  ).toBe("A. Bandara");
});
