import type { Academic } from "../types";

const doctorateLabel: Record<string, string> = {
  completed_documented: "Doctorate documented",
  in_progress: "Doctorate in progress",
  contradictory: "Doctorate evidence needs review",
  unknown: "Doctorate not documented",
};

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

/**
 * A neutral placeholder: initials only. It never depicts appearance, gender or
 * any identity attribute that the source does not establish.
 */
export function AcademicPortrait({ academic }: { academic: Academic }) {
  const status = academic.doctorateStatus || "unknown";
  return (
    <div className="academic-portrait">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Placeholder with initials ${initials(academic.sourceName || academic.name)}`}
      >
        <circle cx="80" cy="80" r="76" className="portrait-disc" />
        <text
          x="80"
          y="80"
          textAnchor="middle"
          dominantBaseline="central"
          className="portrait-initials"
        >
          {initials(academic.sourceName || academic.name)}
        </text>
      </svg>
      <span>
        {doctorateLabel[status]} · {academic.rank}
      </span>
    </div>
  );
}
