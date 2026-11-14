import { TriangleAlert } from "lucide-react";
import type { University } from "../types";

/** Red warning shown on an institution whose public staff data is too thin to trust or compare. */
export function InstitutionNotice({ university }: { university: University }) {
  const n = university.notice;
  if (!n) return null;
  return (
    <aside className="institution-notice" role="note" aria-label={n.title}>
      <TriangleAlert size={22} aria-hidden="true" />
      <div>
        <strong>{n.title}</strong>
        <p>{n.text}</p>
        {(n.source || n.status) && (
          <small>
            {n.source && <>Source: {n.source}</>}
            {n.source && n.status && " · "}
            {n.status && <>Status: {n.status}</>}
          </small>
        )}
        {university.excludeFromComparison && <small className="notice-flag">Excluded from comparisons and statistics.</small>}
      </div>
    </aside>
  );
}
