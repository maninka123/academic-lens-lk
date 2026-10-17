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
const MAX = 96;

/** Splits before a strong degree keyword unless the previous words make it part of the same entry. */
function splitStrong(part: string): string[] {
  const out: string[] = [];
  for (const piece of part.split(NEW_STRONG)) {
    if (out.length && (JOINERS.test(out[out.length - 1]) || piece.length < 2)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

/** Published qualification text as short separate lines: one degree per line. */
export function qualificationLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/\s+/g, " ")
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
    part = part
      .replace(/\bthesis (?:titled|title)\b.*$/i, "")
      .replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, "")
      .trim();
    if (part.length < 2) continue;
    if (part.length > MAX) part = part.slice(0, MAX).replace(/\s+\S*$/, "") + "…";
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(part);
    }
  }
  return lines;
}
