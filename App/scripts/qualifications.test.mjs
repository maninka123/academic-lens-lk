import test from "node:test";
import assert from "node:assert/strict";
import { lowerQualification } from "./qualifications.mjs";

test("degree abbreviations accept spaces and punctuation", () => {
  for (const q of ["MTech (Industrial Eng), BTech (Mech)", "M. Sc in Nursing; B. Sc (Hons)", "M.Pharm; B.Pharm", "LL.M (HR), LL.B", "LL.B (Peradeniya), LL.M (Texas)", "MD (Medicine); MBBS"]) assert.equal(lowerQualification(q), "Masters / MPhil", q);
  for (const q of ["B. Sc. (Hons.) in Plant Biotechnology", "B.Com (Special)", "B.Pharm", "MBBS (USJ)"]) assert.equal(lowerQualification(q), "Bachelors", q);
});
test("ongoing degrees do not replace completed lower degrees", () => {
  for (const q of ["MCom (UoK, Reading) B.Com (Special) (UoK)", "BSc; Master of Bioinformatics (Reading)", "Reading for MSc; BSc", "MBBS; MD Radiology Trainee", "Diploma in Laboratory Technology; B.Sc. (Hons) in Biotechnology, Nilai University, Malaysia Reading for M.Sc. in Food & Nutrition"]) assert.equal(lowerQualification(q), "Bachelors", q);
  assert.equal(lowerQualification("MSc (University of Reading); BSc"), "Masters / MPhil");
  assert.equal(lowerQualification("MSc (ongoing)"), "Unknown");
});
test("headings and placeholder text are not qualifications", () => {
  for (const q of ["Education", "Contact Details", "- | -; sample position | sample location", "University of Paris 8, France", ""]) assert.equal(lowerQualification(q), "Unknown", q);
  assert.equal(lowerQualification("CoC Class I Marine Engineer"), "Other documented");
  assert.equal(lowerQualification("Master Mariner, Certificate in Navigation"), "Other documented");
});
