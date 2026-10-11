import { useState } from "react";
import type { Academic } from "../types";

/** A symbolic illustration, never a likeness or an inference about identity. */
export function AcademicPortrait({ academic }: { academic: Academic }) {
  const [style, setStyle] = useState("neutral");
  const doctorate = academic.qualification === "PhD";
  const senior = /professor|senior|dean|head/i.test(
    academic.rank + " " + academic.position,
  );
  const color = doctorate ? "#7561a8" : senior ? "#2675b9" : "#169688";
  return (
    <div className="academic-portrait">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Illustrated academic placeholder · ${academic.qualification} · ${academic.rank}`}
      >
        <circle cx="80" cy="80" r="78" fill={color} opacity=".12" />
        <path
          d="M29 145 Q31 102 63 101 L97 101 Q130 102 132 145"
          fill={color}
        />
        <path d="M65 101 L80 132 L95 101" fill="#fff" />
        <path d="M74 113 L86 113 L89 145 L71 145Z" fill="#203a53" />
        <path d="M67 88 L67 108 Q80 120 93 108 L93 88" fill="#dbbda6" />
        {style === "long" && (
          <path
            d="M48 60 Q43 22 80 22 Q117 22 112 60 L119 112 L41 112Z"
            fill="#334458"
          />
        )}
        <ellipse cx="80" cy="66" rx="30" ry="37" fill="#ebd1bb" />
        <path
          d="M49 63 Q44 25 80 25 Q116 25 111 63 L102 47 Q75 56 58 44Z"
          fill="#334458"
        />
        <circle cx="69" cy="67" r="2.4" fill="#334458" />
        <circle cx="91" cy="67" r="2.4" fill="#334458" />
        <path
          d="M73 84 Q80 89 87 84"
          fill="none"
          stroke="#79584c"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {senior && (
          <g fill="none" stroke="#334458" strokeWidth="2">
            <rect x="58" y="60" width="20" height="14" rx="5" />
            <rect x="83" y="60" width="20" height="14" rx="5" />
            <path d="M78 65H83" />
          </g>
        )}
        {doctorate && (
          <g>
            <path d="M44 33 L80 18 L116 33 L80 47Z" fill="#203a53" />
            <path d="M58 39V49 Q80 57 102 49V39" fill="#203a53" />
            <path d="M116 33V59" stroke="#b57537" strokeWidth="3" />
            <circle cx="116" cy="61" r="4" fill="#b57537" />
          </g>
        )}
      </svg>
      <span>
        {academic.qualification === "Unknown"
          ? "Qualification unrecorded"
          : academic.qualification}{" "}
        · {senior ? "Senior role" : academic.rank}
      </span>
      <label className="portrait-style">
        Illustration style
        <select
          aria-label="Illustration style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="neutral">Neutral</option>
          <option value="short">Short hair</option>
          <option value="long">Long hair</option>
        </select>
      </label>
    </div>
  );
}
