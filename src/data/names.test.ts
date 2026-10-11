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
  expect(name("Dr. S. Silva", "MBBS")).toBe("Mr S. Silva");
  expect(name("Ms. A. Perera", "PhD", "in_progress")).toBe("Ms A. Perera");
  expect(name("Drashti Perera")).toBe("Mr Drashti Perera");
  expect(
    name("Chair Professor (Dr.) Lalith Edirisinghe", "PhD", "completed"),
  ).toBe("Dr Lalith Edirisinghe*");
});
