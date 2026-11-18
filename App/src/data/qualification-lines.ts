const DEGREE =
  "(?:Ph\\.?\\s?D|D\\.?Phil|M\\.?Phil|M\\.?Sc|B\\.?Sc|M\\.?A\\.?(?=\\s|\\(|,|$)|B\\.?A\\.?(?=\\s|\\(|,|$)|M\\.?B\\.?A|B\\.?Eng|M\\.?Eng|MBBS|M\\.?B\\.?,?\\s?B\\.?S|M\\.?D\\.?(?=\\s|\\(|,|-|$)|M\\.?S\\.?(?=\\s|\\(|,|$)|BDS|B\\.?V\\.?Sc|LL\\.?[BM]|Dip|PGD|PG\\.?\\s?Dip|Postgraduate|Master|Bachelor|Doctor|Diploma|Certificate|Cert\\b|Fellow|FRCS|FRCP|MRCP|MRCOG|FRCA|MRCPCH|FCPS|DCH|DLM|DMJ|D\\.\\s?Ac|Attorney|Chartered|Graduate|B\\.?Tech|M\\.?Tech|B\\.?Com|M\\.?Com|B\\.?Ed|M\\.?Ed|Reading\\s+for|Pursuing|Candidate)";
const NEW_AFTER_COMMA = new RegExp(`,\\s*(?=${DEGREE}(?![a-z]))`);
const NEW_AFTER_CLOSE = new RegExp(`(?<=[\\)\\.])\\s+(?=${DEGREE}(?![a-z]))`);
// Degrees that unmistakably start a new entry even when nothing separates them from the previous one:
// "Ph.D. in X, Ehime University, Japan M.Sc. in Y" or "... 2004 BSc. Eng.".
const STRONG =
  "(?:Ph\\.?\\s?D|M\\.?Phil|M\\.?\\s?Sc|B\\.?\\s?Sc|M\\.?\\s?Eng|B\\.?\\s?Eng|MBA|PG\\.?\\s?Dip|Postgraduate)";
const NEW_STRONG = new RegExp(`\\s+(?=${STRONG}(?![a-z]))`);
const JOINERS = /\b(?:for|in|of|and|to|the|at|a|with|by|from|reading|pursuing|candidate|following|leading)$/i;
const MAX = 130;
const MONTHS: Record<string, string> = { january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun", july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec" };
const SHORT_DEGREES: [RegExp, string][] = [
  [/\bDoctor of Philosophy\b/gi, "PhD"],
  [/\bMaster of Philosophy\b/gi, "MPhil"],
  [/\bMaster of Business Administration\b/gi, "MBA"],
  [/\bMaster of Science\b/gi, "MSc"],
  [/\bMaster of Engineering\b/gi, "MEng"],
  [/\bMaster of Arts\b/gi, "MA"],
  [/\bBachelor of Science(?: Special)?(?= \(|\s+in\b|,|$)/gi, "BSc"],
  [/\bBachelor of Engineering\b/gi, "BEng"],
  [/\bBachelor of Arts\b/gi, "BA"],
  [/\bPost\s?graduate Institute of Medicine\b/gi, "PGIM"],
  [/\bSri Lanka Institute of Information Technology\b/g, "SLIIT"],
  [/\(?\bSecond Class Honou?rs,? Upper Division\)?/gi, "(Second Upper)"],
  [/\(?\b2nd Class\s*[-–]\s*Upper Division\)?/gi, "(Second Upper)"],
];
/** Same wording, fewer characters: standard abbreviations, short dates, no stray dashes or trailing country. */
function compact(part: string): string {
  let t = part;
  // Runs of capitals ("MASTER OF SCIENCE IN INFORMATION TECHNOLOGY") become ordinary title case.
  t = t.replace(/\b(?:[A-Z]{2,}(?:\s+|(?=[,.;:)-]|$))){3,}/g, (run) =>
    run
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(In|Of|And|The|For)\b/g, (m) => m.toLowerCase()),
  );
  for (const [re, to] of SHORT_DEGREES) t = t.replace(re, to);
  t = t.replace(/\((\d{1,2})(?:st|nd|rd|th)? of ([A-Za-z]+) (\d{4})\)/g, (_, _d, m, y) => `(${MONTHS[m.toLowerCase()] ?? m} ${y})`);
  t = t.replace(/\s+[-–]\s+/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",");
  t = t.replace(/,\s*Sri Lanka(?=\.?\s*$|,\s*\d{4})/i, "");
  return t.replace(/\s+/g, " ").trim();
}

/** Splits before a strong degree keyword unless the previous words make it part of the same entry. */
function splitStrong(part: string): string[] {
  const out: string[] = [];
  for (const piece of part.split(NEW_STRONG)) {
    if (out.length && (JOINERS.test(out[out.length - 1]) || piece.length < 2)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

const LEVEL = "(?:Bachelors?|Masters?|PhD|Doctorate|Diploma)";
/**
 * Directory dumps such as "Bachelor, University of Moratuwa,2002 Electrical Engineering Masters, University of X ,2005 Power Systems"
 * list level, institution, year and field in a fixed order; rewrite each as "Bachelor in Electrical Engineering, University of Moratuwa, 2002".
 */
function levelEntries(text: string): string | null {
  if (!new RegExp(`^${LEVEL},\\s`).test(text) || !/,\s*\d{4}\b/.test(text)) return null;
  const parts = text.split(new RegExp(`\\s(?=${LEVEL},\\s)`)).map((piece) => {
    const m = piece.match(new RegExp(`^(${LEVEL}),\\s*(.+?)\\s*,\\s*(\\d{4})\\s*(.*)$`));
    if (!m) return piece;
    const [, level, inst, year, field] = m;
    const named = /^(?:M\.?\s?Sc|B\.?\s?Sc|MPhil|M\.?\s?Eng|B\.?\s?Eng|MBA|PhD|Ph\.D|BA\b|MA\b)/i.test(field);
    const degree = named ? field : `${level}${field ? " in " + field.replace(/^in\s+/i, "") : ""}`;
    return `${degree}, ${inst.replace(/\s+,/g, ",")}, ${year}`;
  });
  return parts.join("; ");
}

/** Published qualification text as short separate lines: one degree per line. */
export function qualificationLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const flat = text.replace(/\s+/g, " ").trim();
  const cleaned = (levelEntries(flat) ?? flat)
    .replace(/\bResearch interests?\b.*$/i, "")
    .trim();
  // A " | " that starts a new degree separates lines; otherwise it joins the details of one line.
  const startsDegree = new RegExp(`^${DEGREE}(?![a-z])`);
  const pieces: string[] = [];
  for (const seg of cleaned.split(/\s*(?:;|\n)\s*/)) {
    const bars = seg.split(/\s\|\s/);
    let current = bars[0];
    for (const b of bars.slice(1)) {
      if (startsDegree.test(b)) {
        pieces.push(current);
        current = b;
      } else current += ", " + b;
    }
    pieces.push(current);
  }
  const parts = pieces.flatMap((p) => p.split(NEW_AFTER_COMMA)).flatMap((p) => p.split(NEW_AFTER_CLOSE)).flatMap(splitStrong);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (let part of parts) {
    part = compact(part)
      .replace(/\bthesis (?:titled|title)\b.*$/i, "")
      .replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, "")
      .trim();
    if (part.length < 2) continue;
    if (part.length > MAX) {
      const cut = part.slice(0, MAX);
      const comma = cut.lastIndexOf(", ");
      part = (comma > 50 ? cut.slice(0, comma) : cut.replace(/\s+\S*$/, "")) + "…";
    }
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(part);
    }
  }
  return lines;
}
