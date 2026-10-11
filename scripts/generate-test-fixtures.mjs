import fs from "node:fs";
import { universities, hierarchy } from "./shared.mjs";
let seed = 20261011;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const fields = [
  "Engineering",
  "Computing / IT",
  "Natural Sciences",
  "Management / Business",
];
const countries = [
  "Sri Lanka",
  "United Kingdom",
  "Australia",
  "United States",
  "Japan",
  "India",
  "Germany",
  "Canada",
];
const ranks = [
  "Lecturer",
  "Senior Lecturer",
  "Associate Professor",
  "Professor",
  "Senior Professor",
];
const rows = universities.flatMap((u, i) =>
  Array.from({ length: 48 }, (_, j) => {
    const field = fields[j % 4],
      rank = ranks[j % 5],
      faculty = "School of " + field,
      department = ["Applied studies", "Systems and methods"][j % 2],
      years = Math.floor(rand() * 34),
      pub = Math.floor(rand() * 200),
      cit = Math.floor(pub * (rand() * 50));
    return {
      id: `DEMO-${u.id}-${j}`,
      name: `Demo Academic ${String(i + 1).padStart(2, "0")}${String(j + 1).padStart(3, "0")}`,
      universityId: u.id,
      facultyId: `${u.id}-f${j % 4}`,
      departmentId: `${u.id}-f${j % 4}-d${j % 2}`,
      university: u.name,
      faculty,
      department,
      type: u.type,
      position: rank,
      rank,
      qualifications: j % 7 ? "PhD; MSc; BSc" : "BSc",
      qualification: j % 7 ? "PhD" : "Bachelors",
      phdUniversity:
        j % 7 ? "Fictional Graduate University " + ((j % 8) + 1) : "",
      phdCountry: j % 7 ? countries[j % 8] : "",
      phdYear: j % 7 ? 2025 - years : null,
      phdStatus: j % 7 ? "demo_verified" : "unknown",
      experience: years,
      interests: field,
      publications: j % 11 ? pub : null,
      citations: j % 9 ? cit : null,
      recentCitations: j % 9 ? Math.floor(cit * 0.4) : null,
      hIndex: j % 11 ? Math.floor(Math.sqrt(pub) * 2) : null,
      q1: j % 11 ? Math.floor(pub * 0.3) : null,
      recentQ1: j % 11 ? Math.floor(pub * 0.15) : null,
      sourceUrl: "",
      scholarUrl: "",
      metricsUrl: "",
      metricsSource: "Synthetic demonstration",
      collectionDate: "2026-10-11",
      snapshotDate: "2026-10-11",
      status: "synthetic",
      employmentStatus: "synthetic",
      field,
      notes: "Fictional demonstration record. Not a real academic.",
    };
  }),
);
hierarchy(rows, "tests/fixtures", universities);
fs.writeFileSync(
  "tests/fixtures/metadata.json",
  JSON.stringify(
    {
      version: "demo-2026-10-11",
      mode: "real",
      collectionDate: "2026-10-11",
      window: [2021, 2025],
      description:
        "720 fictional profiles across all 15 institutions. Do not interpret as institutional evidence.",
      scopeNote: "Synthetic data covers the original 15-institution brief.",
      q1Methodology:
        "Synthetic counts only. A production policy must define ranking provider, category selection and ranking year before adding real Q1 data.",
      limitations: ["All names, qualifications and metrics are fictional."],
    },
    null,
    2,
  ),
);
console.log("Generated 720 reproducible test fixtures (excluded from the website).");
