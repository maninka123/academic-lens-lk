import test from "node:test";
import assert from "node:assert/strict";
import { isNonAcademicPosition } from "./non-academic.mjs";

test("ancillary and non-academic posts are excluded", () => {
  for (const p of [
    "Demonstrator",
    "Laboratory Assistant",
    "Lab Technician",
    "Technical Officer",
    "Research Assistant",
    "Instructor (Permanent) (Faculty of Arts)",
    "Senior Instructor in English",
    "Welding Instructor",
    "Deputy Workshop Supervisor",
    "Warden",
    "Registrar",
    "President / CEO",
    "Assistant Librarian",
  ])
    assert.equal(isNonAcademicPosition(p), true, p);
});

test("academic appointments are kept", () => {
  for (const p of [
    "Professor",
    "Senior Lecturer (Gr I)",
    "Lecturer (Probationary)",
    "Temporary Assistant Lecturer",
    "Assistant Lecturer / Demonstrator in Pharmaceutical Sciences",
    "Lecturer / Simulator Instructor / Cadet Training Officer",
    "Senior Lecturer in Medical Laboratory Sciences",
    "Head of department",
    "Dean",
    "CEO and Vice Chancellor",
    "Senior Consultant",
    "",
  ])
    assert.equal(isNonAcademicPosition(p), false, p);
});
