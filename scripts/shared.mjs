import fs from "node:fs";
import Papa from "papaparse";
export function csvRead(p) {
  const result = Papa.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length) throw Error(p + ": " + result.errors[0].message);
  return result.data;
}
export const csvWrite = (p, r) => {
  fs.mkdirSync(p.substring(0, p.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(p, Papa.unparse(r));
};
export const names = [
  "University of Colombo",
  "University of Peradeniya",
  "University of Sri Jayewardenepura",
  "University of Kelaniya",
  "University of Moratuwa",
  "University of Jaffna",
  "University of Ruhuna",
  "General Sir John Kotelawala Defence University",
  "Sri Lanka Institute of Information Technology",
  "NSBM Green University",
  "CINEC Campus",
  "Horizon Campus",
  "KIU",
  "Saegis Campus",
  "ICBT Campus",
];
export const shorts = [
  "Colombo",
  "Peradeniya",
  "Jayewardenepura",
  "Kelaniya",
  "Moratuwa",
  "Jaffna",
  "Ruhuna",
  "KDU",
  "SLIIT",
  "NSBM",
  "CINEC",
  "Horizon",
  "KIU",
  "Saegis",
  "ICBT",
];
export const universities = names.map((name, i) => ({
  id: shorts[i].toLowerCase(),
  name,
  short: shorts[i],
  type: i < 8 ? "Public" : "Non-state",
}));
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function hierarchy(rows, dir, us) {
  csvWrite(dir + "/universities.csv", us);
  csvWrite(dir + "/faculties.csv", [
    ...new Map(
      rows
        .filter((a) => a.facultyId)
        .map((a) => [
          a.facultyId,
          { id: a.facultyId, universityId: a.universityId, name: a.faculty },
        ]),
    ).values(),
  ]);
  csvWrite(dir + "/departments.csv", [
    ...new Map(
      rows
        .filter((a) => a.departmentId)
        .map((a) => [
          a.departmentId,
          {
            id: a.departmentId,
            facultyId: a.facultyId,
            universityId: a.universityId,
            name: a.department,
          },
        ]),
    ).values(),
  ]);
  csvWrite(dir + "/academics.csv", rows);
}
