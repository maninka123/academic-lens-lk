import type { OrgUnit } from "../types";

type Group<R> = { id: string; label: string; rows: R[] };

/**
 * Splits a university's faculty-level units into regular faculties and "Campuses & Schools".
 * Registered units with no collected staff yet are listed with zero profiles so they can still be opened;
 * nothing is invented for them.
 */
export function splitFacultyUnits<R>(
  groups: Group<R>[],
  registry: OrgUnit[] = [],
  universityId: string,
): { faculties: Group<R>[]; campuses: Group<R>[] } {
  const registered = new Map(registry.filter((u) => u.universityId === universityId).map((u) => [u.id, u]));
  const faculties: Group<R>[] = [];
  const campuses: Group<R>[] = [];
  for (const g of groups) (registered.has(g.id) ? campuses : faculties).push(g);
  for (const u of registered.values())
    if (!groups.some((g) => g.id === u.id)) campuses.push({ id: u.id, label: u.name, rows: [] });
  return { faculties, campuses };
}
