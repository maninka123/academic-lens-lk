import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { useData } from "../data/context";
import { standingColor, fmt } from "./common";
import { MIN_SAMPLE } from "../analytics/quality";
import {
  SCORE_BANDS,
  SCORE_MEASURES,
  standingScore,
  type StandingScore,
} from "../analytics/standing-score";
import type { Academic } from "../types";

const DOCS =
  "https://github.com/maninka123/academic-lens-lk/blob/main/docs/STANDING_SCORE.md";
const CONFIDENCE_TEXT = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;

export function useStandingScore(person: Academic) {
  const { academics } = useData();
  return useMemo(() => standingScore(person, academics), [person, academics]);
}

/** Circular "stamp": ring filled to the score, coloured red → green. */
function Ring({ score, size }: { score: number | null; size: number }) {
  const r = 50,
    c = 2 * Math.PI * r,
    color = score === null ? "var(--border)" : standingColor(score);
  // Near-complete rings use flat caps so the end does not overlap the start.
  const full = score !== null && score >= 97;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="ring-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--soft)" strokeWidth="9" />
      {score !== null && (
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap={full ? "butt" : "round"}
          strokeDasharray={`${Math.min(c, (c * score) / 100)} ${c}`}
          transform="rotate(-90 60 60)"
        />
      )}
      {/* "Typical" (50%) tick at the bottom of the ring. */}
      <line x1="60" y1="104" x2="60" y2="116" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="60" cy="60" r="38" fill="url(#ring-sheen)" />
    </svg>
  );
}

export function ScoreStamp({
  result,
  size = "lg",
  onOpen,
}: {
  result: StandingScore;
  size?: "lg" | "sm";
  onOpen: () => void;
}) {
  const scored = result.score !== null;
  const color = scored ? standingColor(result.score!) : undefined;
  return (
    <div className={"score-stamp " + size + (scored ? "" : " unscored")}>
      <div className="score-row">
      <button
        type="button"
        className="score-ring"
        onClick={onOpen}
        aria-label={
          scored
            ? `Research standing ${result.score}%, ${result.band}. Show how it is calculated`
            : "Research standing not scored. Show why"
        }
      >
        <Ring score={result.score} size={size === "lg" ? 132 : 84} />
        <span className="score-ring-value" style={{ color }}>
          <span className="score-num">
            {scored && result.basis === "indicative" && <em>~</em>}
            {scored ? result.score : "—"}
            {scored && <small>%</small>}
          </span>
        </span>
      </button>
      <div className="score-meta">
        {scored && result.basis === "indicative" && (
          <span className="score-tag">Indicative</span>
        )}
        <strong style={{ color }}>
          {scored ? result.band : "Not scored"}
        </strong>
        <span className="score-sub">
          {scored ? `${result.measuresUsed} of 3 measures` : "Research standing"}
        </span>
        {scored && (
          <span className={"score-conf " + result.confidence}>
            {CONFIDENCE_TEXT[result.confidence!]}
          </span>
        )}
        <button type="button" className="score-info" onClick={onOpen}>
          <Info size={14} aria-hidden="true" />
          How it’s calculated
        </button>
      </div>
      </div>
    </div>
  );
}

/** Three thin bars, one per measure; each opens the calculation. */
export function ScoreBars({
  result,
  onOpen,
}: {
  result: StandingScore;
  onOpen: () => void;
}) {
  if (!result.components.length) return null;
  return (
    <ul className="score-bars" aria-label="Score measures">
      {result.components.map((c) => (
        <li key={c.metric}>
          <button type="button" onClick={onOpen} title={c.note || `${c.label}: ahead of ${Math.round(c.percentile ?? 0)}% of peers. Click for the calculation.`}>
            <span className="score-bar-label">{c.short}</span>
            <span className="score-bar-track">
              {c.percentile !== null && (
                <span style={{ width: `${c.percentile}%`, background: standingColor(c.percentile) }} />
              )}
            </span>
            <span className="score-bar-value" style={c.percentile !== null ? { color: standingColor(c.percentile) } : undefined}>
              {c.percentile !== null ? `${Math.round(c.percentile)}%` : "—"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ScoreDialog({
  result,
  name,
  open,
  onOpenChange,
}: {
  result: StandingScore;
  name: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const scored = result.score !== null;
  const used = result.components.filter((c) => c.status === "scored");
  const formula = used
    .map((c) => `${c.weight.toFixed(2)}×${Math.round(c.percentile!)}`)
    .join(" + ");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="How this score is calculated" className="score-dialog">
      <p className="score-dialog-who">{name}</p>
      <div className="score-dialog-head">
        <div className="score-ring-static">
          <Ring score={result.score} size={96} />
          <span className="score-ring-value" style={{ color: scored ? standingColor(result.score!) : undefined }}>
            {scored && result.basis === "indicative" && <em>~</em>}
            {scored ? result.score : "—"}
            {scored && <small>%</small>}
          </span>
        </div>
        <div>
          <h3 style={{ color: scored ? standingColor(result.score!) : undefined }}>
            {scored ? result.band : "Not scored"}
          </h3>
          <p>
            {scored
              ? `${CONFIDENCE_TEXT[result.confidence!]} | ${result.measuresUsed} of 3 measures`
              : result.reason}
          </p>
        </div>
      </div>

      {result.caveats.length > 0 && (
        <div className="score-fallback" role="note">
          <strong>Indicative score: a fallback was used</strong>
          <ul>
            {result.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <span>Read it as a rough guide, not a precise standing.</span>
        </div>
      )}

      {result.groupLabel && (
        <section className="score-step">
          <h4><span>1</span> Who they are compared with</h4>
          <p>
            <strong>{result.groupLabel}</strong> | {fmt(result.groupSize)} collected profiles
            {result.level === "stage" && result.discipline
              ? ` (the ${result.discipline} group had too few peers, so all disciplines at this stage are used)`
              : result.level === "stage"
                ? " (no discipline is mapped for this person, so all disciplines at this stage are used)"
                : ""}
            . Only people with a value from the same source count.
          </p>
        </section>
      )}

      {result.components.length > 0 && (
        <section className="score-step">
          <h4><span>2</span> Each measure becomes a percentile</h4>
          <div className="table-scroll">
            <table className="score-table">
              <thead>
                <tr>
                  <th>Measure</th><th>Value</th><th>Source</th><th>Peers</th>
                  <th>Ahead of</th><th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {result.components.map((c) => (
                  <tr key={c.metric} className={c.status !== "scored" ? "skipped" : ""}>
                    <th scope="row">{c.label}</th>
                    <td>{c.value === null ? "—" : fmt(c.value)}</td>
                    <td>{c.provider}</td>
                    <td>{c.status === "missing" ? "—" : fmt(c.peers)}</td>
                    <td>
                      {c.percentile === null ? (
                        <span className="muted">{c.status === "missing" ? "Not recorded" : "Too few peers"}</span>
                      ) : (
                        <span className="pct-cell" style={{ color: standingColor(c.percentile) }}>
                          <i><b style={{ width: `${c.percentile}%`, background: standingColor(c.percentile) }} /></i>
                          {Math.round(c.percentile)}%
                        </span>
                      )}
                    </td>
                    <td>{Math.round(c.weight * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.components.filter((c) => c.status !== "scored").map((c) => (
            <p key={c.metric} className="caption score-skip">
              <strong>{c.label}</strong> skipped: {c.note}
            </p>
          ))}
        </section>
      )}

      {scored && (
        <section className="score-step">
          <h4><span>3</span> Blend with the weights</h4>
          <p className="score-formula">
            ({formula}) ÷ {result.weightUsed.toFixed(2)} ={" "}
            <strong style={{ color: standingColor(result.score!) }}>{result.score}%</strong>
          </p>
          <p className="caption">
            Weights are rescaled over the measures that exist, so a missing value
            never counts as zero. At least two measures are needed, and one must
            be h-index or recent citations.
          </p>
          <div className="score-scale" aria-label="Score bands">
            {[...SCORE_BANDS].reverse().map((b) => (
              <span key={b.min} style={{ background: standingColor(b.min + 10) }} className={result.band === b.label ? "active" : ""}>
                {b.min}+ <small>{b.label}</small>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="score-limits">
        <p>
          This percentile shows an academic&rsquo;s relative position among comparable profiles in
          the collected dataset, based on available research indicators. It does not assess overall
          academic quality, teaching, or professional competence. Results may be affected by
          incomplete data, differences between research sources and disciplines, and limited
          coverage.{" "}
          <a href={DOCS} target="_blank" rel="noopener noreferrer">Full methodology</a>
        </p>
      </div>
    </Dialog>
  );
}

/** Stamp + bars + dialog, ready to drop beside a person's name. */
export function StandingScorePanel({ person, size = "lg", bars = true }: { person: Academic; size?: "lg" | "sm"; bars?: boolean }) {
  const result = useStandingScore(person);
  const [open, setOpen] = useState(false);
  return (
    <div className="score-panel">
      <ScoreStamp result={result} size={size} onOpen={() => setOpen(true)} />
      {bars && <ScoreBars result={result} onOpen={() => setOpen(true)} />}
      <ScoreDialog result={result} name={person.name} open={open} onOpenChange={setOpen} />
    </div>
  );
}
