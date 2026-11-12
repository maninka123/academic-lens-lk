import type { Academic } from "../types";

/** Initials of the published name, without titles. */
export function initials(name: string) {
  const words = name
    .replace(/\*/g, "")
    .replace(/^(?:Dr|Mr|Mrs|Ms|Miss)\s+/i, "")
    .split(/[\s.]+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w));
  return ((words[0]?.[0] || "") + (words.length > 1 ? words.at(-1)![0] : ""))
    .toUpperCase()
    .slice(0, 2);
}

/** A monogram, never a likeness: the dataset holds names, not photographs. */
export function AcademicPortrait({ academic }: { academic: Academic }) {
  const mark = initials(academic.sourceName || academic.name) || "?";
  return (
    <div className="academic-portrait monogram" role="img" aria-label={`Monogram for ${academic.name}`}>
      <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <circle cx="48" cy="48" r="46" className="mono-disc" />
        <circle cx="48" cy="48" r="46" className="mono-orbit" />
        <text x="48" y="48" textAnchor="middle" dominantBaseline="central" className="mono-text">{mark}</text>
      </svg>
    </div>
  );
}
