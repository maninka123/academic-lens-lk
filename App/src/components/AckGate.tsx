import { useEffect, useRef, useState } from "react";
import { PreviewBadge } from "./PreviewBadge";
import { BrandMark } from "./BrandMark";
import { ackRequired, needsNoticeOnArrival, recordVisit } from "./ackPolicy";
import { PRIVACY_URL, guideHref } from "./guideLinks";

/** Data-use notice: shown on the first visit and again after 24 hours away; the visitor must accept to continue. */
export function AckGate() {
  const [ok, setOk] = useState(() => !needsNoticeOnArrival());
  const [checked, setChecked] = useState(false);
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.body.style.overflow = ok ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ok]);
  useEffect(() => {
    // Resuming a tab: refresh the timestamp, or ask again after 24 hours away. Leaving records the moment.
    const onVisibility = () => {
      if (!ok) return;
      if (document.visibilityState === "hidden") recordVisit();
      else if (ackRequired()) setOk(false);
      else recordVisit();
    };
    const onLeave = () => {
      if (ok) recordVisit();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [ok]);
  if (ok) return null;
  return (
    <div className="ack-overlay" role="dialog" aria-modal="true" aria-labelledby="ack-title">
      <div className="ack-card">
        <div className="ack-brand">
          <BrandMark size={22} /> Lanka Academia
          <PreviewBadge className="ack-preview" />
        </div>
        <h2 id="ack-title">Understanding the Data</h2>
        <p>
          Lanka Academia is an independent research platform presenting publicly available
          academic information and research statistics.
        </p>
        <p className="ack-lead">Before exploring, please note:</p>
        <ul>
          <li>
            <strong>Indicative, not definitive:</strong> Research metrics and comparisons describe
            recorded research activity. They do not measure academic quality, competence or
            teaching ability.
          </li>
          <li>
            <strong>Data may be incomplete:</strong> Qualifications, publications, citations and
            other information may be outdated, missing or incorrectly attributed.
          </li>
          <li>
            <strong>Not for individual decisions:</strong> These indicators are not designed or
            validated for recruitment, promotion, funding, disciplinary or other decisions
            affecting individuals.
          </li>
          <li>
            <strong>Verify before relying:</strong> Check original sources and confirm a figure is
            correct before using it. Consider the methodology and limitations.
          </li>
          <li>
            <strong>Corrections and removal:</strong> Academics can request corrections or removal
            of their profiles without providing a reason.
          </li>
        </ul>
        <p className="ack-links">
          <a href={guideHref()} target="_blank" rel="noopener noreferrer">How to Interpret the Data</a>
          <span aria-hidden="true">|</span>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy &amp; Corrections</a>
        </p>
        <label className="ack-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I understand that these are indicative research statistics, not assessments of academic
          quality, and agree to interpret them responsibly.
        </label>
        <div className="ack-actions">
          <button
            ref={enter}
            type="button"
            className="button primary"
            disabled={!checked}
            onClick={() => {
              recordVisit();
              setOk(true);
            }}
          >
            Enter platform
          </button>
          <button type="button" className="button btn-outline" onClick={() => (window.location.href = "about:blank")}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
