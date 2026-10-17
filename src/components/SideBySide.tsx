import { useState } from "react";
import { Link } from "react-router-dom";
import { Crown, ExternalLink, X } from "lucide-react";
import type { Academic } from "../types";
import { CountryName, fmt, personColors, short } from "./common";
import { ScoreBars, ScoreDialog, ScoreStamp, useStandingScore } from "./StandingScore";
import { researchProfileLinks } from "./ResearchProfiles";
import { Button } from "./ui/button";

type Row = { key: string; label: string; best?: boolean };
const ROWS: Row[] = [
  { key: "hIndex", label: "h-index", best: true },
  { key: "citations", label: "Citations", best: true },
  { key: "recentCitations", label: "Citations 2021–2025", best: true },
  { key: "publications", label: "Publications", best: true },
];

function Column({
  person,
  index,
  best,
  onRemove,
}: {
  person: Academic;
  index: number;
  best: Set<string>;
  onRemove: () => void;
}) {
  const result = useStandingScore(person);
  const [open, setOpen] = useState(false);
  const tone = personColors[index % personColors.length];
  const links = researchProfileLinks(person).filter((l) => l.url);
  return (
    <article className="sbs-col" style={{ borderTopColor: tone }}>
      <header>
        <div>
          <Link className="sbs-name" to={"/academics/" + person.id}>{person.name}</Link>
          <p>{person.position || person.rank}</p>
          <p className="sbs-uni">{short(person.university)}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={"Remove " + person.name} onClick={onRemove}>
          <X size={18} />
        </Button>
      </header>

      <div className="sbs-score">
        <ScoreStamp result={result} size="sm" onOpen={() => setOpen(true)} />
        <ScoreBars result={result} onOpen={() => setOpen(true)} />
        <ScoreDialog result={result} name={person.name} open={open} onOpenChange={setOpen} />
      </div>

      <dl className="sbs-measures">
        {ROWS.map((r) => {
          const v = person[r.key as keyof Academic] as number | null;
          const isBest = v !== null && best.has(r.key + ":" + v);
          return (
            <div key={r.key} className={isBest ? "best" : ""}>
              <dt>{r.label}</dt>
              <dd>
                {v === null ? <span className="muted">—</span> : fmt(v)}
                {isBest && <Crown size={14} aria-label="Highest of those shown" />}
              </dd>
            </div>
          );
        })}
      </dl>

      <dl className="sbs-facts">
        <div><dt>Faculty</dt><dd>{person.faculty || "—"}</dd></div>
        <div><dt>Department</dt><dd>{person.department || "—"}</dd></div>
        <div><dt>Discipline</dt><dd>{person.field && person.field !== "Unmapped" ? person.field : "—"}</dd></div>
        <div>
          <dt>PhD</dt>
          <dd>
            {person.doctorateStatus === "completed_documented" ? (
              <>
                {person.phdYear ?? "Completed"}
                {person.phdCountry && <> | <CountryName country={person.phdCountry} /></>}
                {person.phdUniversity && <small>{person.phdUniversity}</small>}
              </>
            ) : person.doctorateStatus === "in_progress" ? "In progress" : "Not documented"}
          </dd>
        </div>
        <div><dt>Qualification</dt><dd>{person.qualification !== "Unknown" ? person.qualification : "—"}</dd></div>
        <div><dt>Interests</dt><dd className="sbs-interests">{person.interests || "—"}</dd></div>
        <div>
          <dt>Sources</dt>
          <dd className="sbs-links">
            {links.length
              ? links.map((l) => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label} <ExternalLink size={13} />
                  </a>
                ))
              : "—"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Up to three people, one column each, with the best value in each row marked. */
export function SideBySide({
  people,
  onRemove,
  onClear,
}: {
  people: Academic[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  // A "best" mark needs at least two people with a value.
  const best = new Set<string>();
  if (people.length > 1)
    for (const r of ROWS) {
      const vals = people
        .map((p) => p[r.key as keyof Academic] as number | null)
        .filter((v): v is number => typeof v === "number");
      if (vals.length > 1) {
        const top = Math.max(...vals);
        if (vals.filter((v) => v === top).length < vals.length) best.add(r.key + ":" + top);
      }
    }
  return (
    <section className="card sbs" aria-label="Side by side">
      <div className="section-heading">
        <div>
          <h2>Side by side</h2>
          <p>{people.length} of 3 people. Tick or untick rows in the directory below to change this view.</p>
        </div>
        <Button variant="outline" onClick={onClear}>Clear</Button>
      </div>
      <div className={"sbs-grid cols-" + people.length}>
        {people.map((p, i) => (
          <Column key={p.id} person={p} index={i} best={best} onRemove={() => onRemove(p.id)} />
        ))}
      </div>
    </section>
  );
}
