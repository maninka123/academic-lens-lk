import { expect, it } from "vitest";
import { academicDisplayName } from "./names";
const name = (n: string, qualification = "Unknown", phdStatus = "unknown") =>
  academicDisplayName({
    name: n,
    qualification,
    phdStatus,
    qualifications: qualification,
  });
it("keeps Prof ahead of Dr while retaining the doctorate evidence marker", () => {
  expect(name("Prof. (Mrs.) A. Perera", "PhD", "completed")).toBe(
    "Prof A. Perera*",
  );
  expect(name("Ms. A. Perera", "PhD", "in_progress")).toBe("Ms A. Perera");
  expect(
    name("Chair Professor (Dr.) Lalith Edirisinghe", "PhD", "completed"),
  ).toBe("Prof Lalith Edirisinghe*");
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

it("uses documented professorial roles and does not turn a lecturer into Prof", () => {
  const a = {
    name: "Dr A. Perera",
    qualification: "PhD",
    phdStatus: "completed",
    qualifications: "PhD",
  };
  expect(academicDisplayName({ ...a, rank: "Senior Professor" })).toBe(
    "Prof A. Perera*",
  );
  expect(academicDisplayName({ ...a, position: "Associate Professor" })).toBe(
    "Prof A. Perera*",
  );
  expect(academicDisplayName({ ...a, rank: "Senior Lecturer" })).toBe(
    "Dr A. Perera*",
  );
  expect(
    academicDisplayName({
      ...a,
      doctorateStatus: "contradictory",
      rank: "Professor",
    }),
  ).toBe("Prof A. Perera");
});

it("reads a surname-first directory name in the usual order", () => {
  expect(name("Seneviratne, Prof. S.D.S.")).toBe("Prof S.D.S. Seneviratne");
  expect(name("Herath, Dr. K.", "PhD", "completed")).toBe("Prof K. Herath".replace("Prof", "Dr") + "*");
  expect(name("Prof. A. Perera")).toBe("Prof A. Perera");
});
