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

export function AcademicPortrait({ academic }: { academic: Academic }) {
  const longHair = /\b(?:Mrs|Ms|Miss)\b/i.test(
    academic.sourceName || academic.name,
  );
  const coat =
    academic.doctorateStatus === "completed_documented" ? "#bd3a43" : "#54788b";
  return (
    <div className="academic-portrait illustrated-portrait">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label="Illustrated academic placeholder"
      >
        <circle cx="80" cy="80" r="76" className="portrait-disc" />
        {longHair && (
          <path
            d="M43 70c0-31 15-44 37-44s37 13 37 44l7 51H36z"
            fill="#343235"
          />
        )}
        <path d="M26 144c2-29 16-43 40-46h28c24 3 38 17 40 46" fill={coat} />
        <path d="M67 97h26l-3 16H70z" fill="#e8b999" />
        <path d="m66 106 14 10 14-10-4 38H70z" fill="#fcfcfd" />
        <path
          d="m60 103 20 13-14 15-10-19zm40 0-20 13 14 15 10-19z"
          fill={coat}
          stroke="#ffffff35"
          strokeWidth="2"
        />
        <ellipse cx="80" cy="70" rx="28" ry="34" fill="#f0c7a8" />
        <path
          d={
            longHair
              ? "M50 73V55c0-23 15-30 30-30s30 7 30 30v18c-6-7-10-18-12-27-15 15-27 16-48 16z"
              : "M51 65V50c0-17 17-26 33-23 12 2 22 6 26 17l-3 21-9-16c-15 6-23 6-37 3z"
          }
          fill="#343235"
        />
        <path
          d="M63 69h10m14 0h10"
          stroke="#55413a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="68" cy="76" r="2.3" fill="#343235" />
        <circle cx="92" cy="76" r="2.3" fill="#343235" />
        <path
          d="m80 78-2 8h4m-12 7q10 8 20 0"
          fill="none"
          stroke="#b57565"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M107 124h12"
          stroke="#fff9"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
