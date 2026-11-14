// Non-academic and ancillary posts are kept in the private source CSVs but never published or used.
//
// Excluded from public data, the app, counts and every comparison: demonstrators, laboratory
// assistants and technicians, technical officers, research assistants, instructors, workshop
// supervisors, wardens, registrars, managers, chief executives and librarians. A post that also
// states an academic grade (lecturer, professor) is kept, for example "Assistant Lecturer /
// Demonstrator in X": the person holds an academic appointment.

const ACADEMIC_GRADE = /\b(professor|lecturer|reader)\b/i;

const NON_ACADEMIC = [
  /\bdemonstrator\b/i,
  /\blab(oratory)?\s+(assistant|attendant|technician|officer|instructor)\b/i,
  /\btechnician\b/i,
  /\btechnical\s+(officer|assistant|instructor)\b/i,
  /\bresearch\s+assistant\b/i,
  /\binstructor\b/i,
  /\bworkshop\s+(supervisor|instructor|assistant)\b/i,
  /\b(assistant\s+)?warden\b/i,
  /\bregistrar\b/i,
  /\b(assistant\s+|deputy\s+)?manager\b/i,
  /\b(chief\s+executive|ceo)\b/i,
  /\blibrarian\b/i,
  /\b(clerk|driver|attendant|security\s+officer|office\s+assistant|programme\s+assistant)\b/i,
];

/** True when the recorded position is a non-academic or ancillary post. */
export function isNonAcademicPosition(position) {
  const p = String(position ?? "");
  if (!p.trim()) return false;
  // Librarians are excluded even when the title also says "senior".
  if (/\blibrarian\b/i.test(p)) return true;
  // A vice-chancellor leads the university academically: not an ancillary post.
  if (/vice[- ]chancellor/i.test(p)) return false;
  if (ACADEMIC_GRADE.test(p) && !/^\s*(senior\s+)?instructor\b/i.test(p)) {
    // "Lecturer / Simulator Instructor" and "Assistant Lecturer / Demonstrator" hold an academic grade.
    return false;
  }
  return NON_ACADEMIC.some((re) => re.test(p));
}
