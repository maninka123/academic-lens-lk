import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";

const KEY = "lanka-academia-ack-v1";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** First-visit notice: the data are partial and descriptive; the visitor must accept to continue. */
export function AckGate() {
  const [ok, setOk] = useState(read);
  const [checked, setChecked] = useState(false);
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.body.style.overflow = ok ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ok]);
  if (ok) return null;
  return (
    <div className="ack-overlay" role="dialog" aria-modal="true" aria-labelledby="ack-title">
      <div className="ack-card">
        <div className="ack-brand">
          <BookOpen size={18} aria-hidden="true" /> Lanka Academia
          <span className="ack-preview">Ongoing Research | Public Preview</span>
        </div>
        <h2 id="ack-title">Research data and responsible use</h2>
        <p>
          Lanka Academia is an independent academic research and statistical exploration
          platform. It compiles publicly available professional and research information from
          academic institutions and research databases.
        </p>
        <p className="ack-lead">Before continuing, please understand:</p>
        <ul>
          <li>Information may be incomplete, outdated, or incorrectly matched.</li>
          <li>
            Comparisons and indicators are descriptive research statistics, not official
            assessments of academic ability, teaching quality, or professional suitability.
          </li>
          <li>
            Results must not be the sole basis for recruitment, promotion, funding,
            disciplinary, or other decisions affecting individuals.
          </li>
          <li>Verify information against original sources and acknowledge the dataset's limitations.</li>
          <li>Individuals may request corrections or removal of their published profiles. See the <a href="https://github.com/maninka123/academic-lens-lk/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">privacy and data-use notice</a>.</li>
        </ul>
        <label className="ack-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I have read and understand these conditions and agree to use the information responsibly.
        </label>
        <div className="ack-actions">
          <button
            ref={enter}
            type="button"
            className="button primary"
            disabled={!checked}
            onClick={() => {
              try {
                localStorage.setItem(KEY, "1");
              } catch {
                /* the notice simply shows again next visit */
              }
              setOk(true);
            }}
          >
            Enter platform
          </button>
          <button type="button" className="button outline" onClick={() => (window.location.href = "about:blank")}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
