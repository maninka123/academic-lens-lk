import type { Academic } from "../types";
/**
 * Display name convention: "Dr Name*" only with documented completed-doctorate
 * evidence; otherwise an honorific is shown only when the source itself states
 * one (Mr, Mrs, Ms, Miss). No honorific or gender is ever inferred.
 */
export function academicDisplayName(
  a: Pick<Academic, "name" | "qualification" | "phdStatus" | "qualifications"> &
    Partial<Pick<Academic, "doctorateStatus">>,
) {
  const original = a.name.trim();
  const sourceTitle = original.match(
    /(?:^|[\s.(])(Mrs|Ms|Miss|Mr)\.?\s*(?:\)|\s|(?=[A-Z]))/i,
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
  const doctorate = a.doctorateStatus
    ? a.doctorateStatus === "completed_documented"
    : a.phdStatus !== "in_progress" &&
      (a.qualification === "PhD" ||
        (!/honorary/i.test(a.qualifications) &&
          /\bD\.?Sc\b|\bD\.?Litt\b|Doctor of (?:Science|Letters)/i.test(
            a.qualifications,
          )));
  const title = doctorate
    ? "Dr"
    : sourceTitle
      ? sourceTitle[0].toUpperCase() + sourceTitle.slice(1).toLowerCase()
      : "";
  return `${title ? title + " " : ""}${name}${doctorate ? "*" : ""}`;
}
