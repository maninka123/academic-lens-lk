import type { Academic } from "../types";

type Qs = Pick<Academic, "phdQsRank" | "phdQsStatus">;

/** "QS #22" for a position (ties keep the = in the tooltip), "QS 1001–1200" for a band. */
export function qsMain(a: Qs): string | null {
  if (a.phdQsStatus === "not_ranked") return "Not in QS";
  if (a.phdQsStatus !== "ranked" || !a.phdQsRank) return null;
  const r = a.phdQsRank.trim();
  if (/^=?\d+$/.test(r)) return "QS #" + r.replace("=", "");
  return "QS " + r.replace("-", "–");
}

/** Plain-text version, for tables and exports. */
export function qsText(a: Qs): string | null {
  const m = qsMain(a);
  return m ? `${m} · 2027` : null;
}

/** Ranking of the PhD-awarding university: "QS #4 · 2027". */
export function QsRank({ academic }: { academic: Qs }) {
  const main = qsMain(academic);
  if (!main) return null;
  const tied = /^=/.test(academic.phdQsRank ?? "");
  return (
    <span
      className={"qs-rank" + (academic.phdQsStatus === "ranked" ? "" : " unranked")}
      title={`QS World University Rankings 2027${academic.phdQsStatus === "ranked" ? `: ${tied ? "joint " : ""}${academic.phdQsRank!.replace("=", "")}` : ": not ranked"}`}
    >
      <b>{main}</b>
      <i>· 2027</i>
    </span>
  );
}
