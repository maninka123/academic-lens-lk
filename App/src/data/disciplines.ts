import type { Academic } from "../types";

/**
 * Broad discipline inferred from the published faculty/department name. This is
 * a descriptive grouping of unit titles, not a verified field classification;
 * units that do not match stay "Unclassified".
 */
const RULES: [RegExp, string][] = [
  [
    /medic|health|nursing|dental|surgery|allied|pharm|physiother|siddha|ayurved|unani|veterinar/i,
    "Medicine & health",
  ],
  [
    /comput|information technology|software|informatics|data science|\bIT\b/i,
    "Computing & IT",
  ],
  [/engineer|marine|technology/i, "Engineering & technology"],
  [
    /architect|built environment|design|town|planning|spatial/i,
    "Architecture & design",
  ],
  [/agricult|animal|food|fisher|plantation|forestry/i, "Agriculture & food"],
  [
    /manag|commerce|business|financ|account|econom|marketing|logistic/i,
    "Management & commerce",
  ],
  [
    /law|legal|criminal|political|sociolog|social|education|psycholog|defence|strategic/i,
    "Social sciences, law & education",
  ],
  [
    /arts|humanit|language|english|sinhala|tamil|hindi|music|dance|aesthetic|history|philosoph|fine art/i,
    "Arts & humanities",
  ],
  [
    /science|physic|chemi|math|statist|biolog|zoolog|botan|geolog|nuclear|earth/i,
    "Natural sciences",
  ],
];
export function broadDiscipline(a: Pick<Academic, "faculty" | "department">) {
  const unit = `${a.department || ""} ${a.faculty || ""}`;
  return RULES.find(([re]) => re.test(unit))?.[1] || "Unclassified";
}
