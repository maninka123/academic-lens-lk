import type { Academic } from "../types";
export function academicDisplayName(
  a: Pick<Academic, "name" | "qualification" | "phdStatus" | "qualifications">,
) {
  const original = a.name.trim();
  const femaleTitle = original.match(
    /(?:^|[\s.(])(Mrs|Ms|Miss)\.?\s*(?:\)|\s|(?=[A-Z]))/i,
  )?.[1];
  let name = original;
  const prefix =
    /^(?:(?:senior|snr\.?|emeritus|emerita|associate|assistant|chair|honorary)\s+)?(?:professor|prof|doctor|dr|mrs|mr|ms|miss|engineer|engr|eng|rev|ven)(?:\.|\b)\s*/i;
  for (let i = 0; i < 6; i++) {
    const cleaned = name
      .replace(prefix, "")
      .replace(/^\(\s*(?:dr|mrs|ms|mr)\.?\s*\)\s*/i, "");
    if (cleaned === name) break;
    name = cleaned;
  }
  name = name
    .replace(/\s*\(on (?:sabbatical |study )?leave\)\s*/gi, "")
    .replace(/,\s*(?:chartered|ph\.?d|m\.?sc|b\.?sc|mbbs|md\b).*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  const doctorate =
    a.phdStatus !== "in_progress" &&
    (a.qualification === "PhD" ||
      (!/honorary/i.test(a.qualifications) &&
        /\bD\.?Sc\b|\bD\.?Litt\b|Doctor of (?:Science|Letters)/i.test(
          a.qualifications,
        )));
  const title = doctorate
    ? "Dr"
    : femaleTitle
      ? femaleTitle[0].toUpperCase() + femaleTitle.slice(1).toLowerCase()
      : "Mr";
  return `${title} ${name}${doctorate ? "*" : ""}`;
}
