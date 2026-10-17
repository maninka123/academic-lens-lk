import { Award } from "lucide-react";
import type { Academic } from "../types";

/** Text for a person's awarding-university ranking, or null when the rank was not located. */
export function qsText(a: Pick<Academic, "phdQsRank" | "phdQsStatus">): string | null {
  if (a.phdQsStatus === "ranked" && a.phdQsRank) return `Uni ranking ${a.phdQsRank} (QS 2027)`;
  if (a.phdQsStatus === "not_ranked") return "Not in the QS 2027 ranking";
  return null;
}

/** Small ranking pill shown beside a PhD-awarding university. */
export function QsRank({ academic, short = false }: { academic: Pick<Academic, "phdQsRank" | "phdQsStatus">; short?: boolean }) {
  const full = qsText(academic);
  const text = !full ? null : short ? (academic.phdQsStatus === "ranked" ? `QS 2027: ${academic.phdQsRank}` : "Not in QS 2027") : full;
  if (!text) return null;
  return (
    <span className={"qs-rank" + (academic.phdQsStatus === "ranked" ? "" : " unranked")} title={full ?? "QS World University Rankings 2027"}>
      <Award size={13} aria-hidden="true" />
      {text}
    </span>
  );
}
