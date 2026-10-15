import type { Academic, NumericMetric, Provider } from "../types";
import { peers, percentile, summary, values } from "./engine";
import {
  equivalentPosition,
  MIN_SAMPLE,
  providerCounts,
  providerOf,
  withProvider,
} from "./quality";

export const peerContexts = [
  ["department", "Same department"],
  ["faculty", "Same faculty"],
  ["university", "Same university"],
  ["field", "Same field · all universities"],
  ["rank", "Same position · all universities"],
  ["qualification", "Same qualification"],
  ["sector", "Same institution type"],
  ["all", "All collected profiles"],
] as const;
export type PeerCohort = "position" | "qualification" | "both" | "phd" | "all";
const known = (s: string) =>
  Boolean(s?.trim()) &&
  !/^(unknown|unmapped|unclassified|other|unrecorded|not (recorded|published|listed|available))\b/i.test(
    s.trim().replace(/[_-]+/g, " "),
  );
export const positionLabel = (a: Academic) =>
  ["Other", "Unknown"].includes(a.rank)
    ? a.position
    : equivalentPosition(a.rank);
export const samePosition = (a: Academic, r: Academic) =>
  known(positionLabel(a)) &&
  (["Other", "Unknown"].includes(a.rank)
    ? r.position === a.position
    : equivalentPosition(r.rank) === equivalentPosition(a.rank));
export function cohortDescription(a: Academic, cohort: PeerCohort) {
  const role = positionLabel(a) || "unrecorded position";
  return {
    position: `${role} positions only`,
    qualification: `${a.qualification} qualifications only`,
    both: `${role} positions with ${a.qualification} qualifications`,
    phd: "Documented PhD holders only",
    all: "All positions and qualifications",
  }[cohort];
}
export function contextDescription(a: Academic, key: string) {
  return (
    {
      department: `${a.department} within ${a.faculty}, ${a.university}`,
      faculty: `${a.faculty} within ${a.university}`,
      university: a.university,
      field: known(a.field)
        ? `The same broad discipline (${a.field}) across collected institutions; inferred from faculty and department names`
        : "No mapped discipline is recorded for this person",
      rank: known(positionLabel(a))
        ? `${positionLabel(a)} positions across collected institutions; normalised role, not identical source wording`
        : "No usable position is recorded for this person",
      qualification: known(a.qualification)
        ? `${a.qualification} as the highest documented qualification; not necessarily the same degree subject`
        : "No documented qualification category is recorded for this person",
      sector: `${a.type} institutions only`,
      all: "All collected Sri Lankan institutions, within the selected cohort",
    }[key] || ""
  );
}
/** Compact label of who is in a peer context, for hover chips ("A · B · C"). */
export function contextShort(a: Academic, key: string) {
  const role = positionLabel(a);
  return (
    {
      department: a.department,
      faculty: a.faculty,
      university: a.university,
      field: known(a.field) ? a.field : "No discipline mapped",
      rank: known(role) ? role : "No usable position",
      qualification: known(a.qualification) ? a.qualification : "No qualification",
      sector: a.type,
      all: "Everyone collected",
    }[key] || ""
  );
}
export function cohortShort(a: Academic, cohort: PeerCohort) {
  const role = positionLabel(a) || "Unrecorded position";
  return {
    position: `${role} only`,
    qualification: `${a.qualification} holders only`,
    both: `${role}, ${a.qualification} only`,
    phd: "PhD holders only",
    all: "All positions",
  }[cohort];
}
export function buildPeerGroups(
  rows: Academic[],
  a: Academic,
  metric: NumericMetric,
  cohort: PeerCohort,
) {
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  const cohortRows = unique.filter(
    (r) =>
      cohort === "all" ||
      (cohort === "position" && samePosition(a, r)) ||
      (cohort === "qualification" &&
        known(a.qualification) &&
        r.qualification === a.qualification) ||
      (cohort === "both" &&
        samePosition(a, r) &&
        known(a.qualification) &&
        r.qualification === a.qualification) ||
      (cohort === "phd" && r.qualification === "PhD"),
  );
  const native = providerOf(a, metric);
  const provider: Provider =
    a[metric] != null
      ? native
      : providerCounts(cohortRows, metric).find(([p]) =>
          ["Google Scholar", "ResearchGate", "OpenAlex"].includes(p),
        )?.[0] || "Not recorded";
  const supported = ["Google Scholar", "ResearchGate", "OpenAlex"].includes(
    provider,
  );
  const groups = peerContexts
    .filter(
      ([key]) =>
        (key !== "department" || Boolean(a.departmentId)) &&
        (key !== "faculty" || Boolean(a.facultyId)),
    )
    .map(([key, label]) => {
      const members =
        key === "qualification"
          ? known(a.qualification)
            ? cohortRows.filter((r) => r.qualification === a.qualification)
            : []
          : key === "sector"
            ? cohortRows.filter((r) => r.type === a.type)
            : key === "rank"
              ? cohortRows.filter((r) => samePosition(a, r))
              : key === "field" && !known(a.field)
                ? []
                : peers(cohortRows, a, key);
      const measured = supported
        ? withProvider(members, provider).rows
        : members.map((r) => ({ ...r, [metric]: null }));
      const v = values(measured.map((r) => r[metric]));
      const stats = summary(v),
        enough = v.length >= MIN_SAMPLE;
      return {
        key,
        label: key === "all" && cohort !== "all" ? "All selected peers" : label,
        description: [contextShort(a, key), cohortShort(a, cohort), provider].filter(Boolean).join(" · "),
        members,
        measured,
        v,
        ...stats,
        median: enough ? stats.median : null,
        mean: enough ? stats.mean : null,
        q1: enough ? stats.q1 : null,
        q3: enough ? stats.q3 : null,
        percentile:
          enough && supported
            ? percentile(v, Number.isFinite(a[metric]) ? a[metric] : null)
            : null,
      };
    });
  return { provider, cohortRows, groups };
}
