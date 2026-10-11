// Match evidence by researcher identity, not incidental URL query parameters.
export function profileKey(value = "") {
  try {
    const u = new URL(value.trim());
    if (/^scholar\.google\./i.test(u.hostname))
      return "scholar:" + (u.searchParams.get("user") || u.pathname);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return value;
  }
}
export function resolveAlias(id, aliases) {
  const seen = new Set();
  while (aliases[id]) {
    if (seen.has(id)) throw Error("Circular academic alias: " + id);
    seen.add(id);
    id = aliases[id];
  }
  return id;
}
export function linkStatus(id, url, evidence, aliases) {
  if (!url) return "not_recorded";
  return (
    evidence
      .filter(
        (e) =>
          resolveAlias(e.academic_id, aliases) === id &&
          profileKey(e.profile_url) === profileKey(url),
      )
      .sort((a, b) => a.checked_at.localeCompare(b.checked_at))
      .at(-1)?.identity_verification_status || "recorded_unverified"
  );
}
export const metricFields = {
  publications: "total_publications",
  citations: "total_citations",
  recentCitations: "citations_2021_2025",
  hIndex: "h_index",
  q1: "total_q1_journal_publications",
  recentQ1: "q1_publications_2021_2025",
};
export function metricEvidence(row, snapshots, observations, aliases) {
  const samePerson = (e) =>
    resolveAlias(e.academic_id, aliases) === row.academic_id;
  const ss = snapshots.filter(samePerson),
    os = observations.filter(samePerson);
  return Object.entries(metricFields).flatMap(([metric, column]) => {
    if (row[column] === "" || row[column] == null) return [];
    const value = Number(row[column]);
    const observed = os
      .filter(
        (e) =>
          e.metric === column && e.value !== "" && Number(e.value) === value,
      )
      .map((e) => ({
        source: e.platform,
        url: e.source_url,
        date: e.retrieved_at,
        note: e.notes,
      }));
    const snapshotColumn =
      metric === "publications"
        ? "publications"
        : metric === "citations"
          ? "citations"
          : null;
    const fallback = snapshotColumn
      ? ss
          .filter(
            (e) =>
              e[snapshotColumn] !== "" && Number(e[snapshotColumn]) === value,
          )
          .map((e) => ({
            source: e.source,
            url: e.profile_url,
            date: e.retrieved_at,
            note: e.freshness,
          }))
      : [];
    const selected = (observed.length ? observed : fallback)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    return [
      {
        metric,
        value,
        ...(selected || {
          source: row.research_metrics_source || "Not recorded",
          url: row.metrics_source_url || "",
          date: "",
          note: "Field-specific evidence has not been recorded.",
        }),
      },
    ];
  });
}
export function normaliseRank(position) {
  const rules = [
    [/senior professor/i, "Senior Professor"],
    [/ass(?:ociate|osiate) professor/i, "Associate Professor"],
    [/assistant professor/i, "Assistant Professor"],
    [/professor/i, "Professor"],
    [/senior lecturer/i, "Senior Lecturer"],
    [/assistant lecturer/i, "Assistant Lecturer"],
    [/lecturer/i, "Lecturer"],
    [/librarian/i, "Librarian"],
    [/instructor/i, "Instructor"],
  ];
  return (
    rules.find(([pattern]) => pattern.test(position))?.[1] ||
    (position ? "Other" : "Unknown")
  );
}
