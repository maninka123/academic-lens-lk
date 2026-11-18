import { useEffect, useState } from "react";
import Papa from "papaparse";

export type QsEntry = {
  institution: string;
  country: string;
  qsRank: string;
  qsStatus: "ranked" | "not_ranked" | "not_located" | string;
  basis: string;
  universityId: string;
};

let cache: Promise<QsEntry[]> | null = null;

/** QS World University Rankings 2027 table for PhD-awarding institutions and Sri Lankan universities. */
export function loadQsTable(): Promise<QsEntry[]> {
  cache ??= fetch(import.meta.env.BASE_URL + "data/qs_rankings_2027.csv", { cache: "no-store" })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error("QS table unavailable"))))
    .then((t) => Papa.parse<QsEntry>(t, { header: true, skipEmptyLines: true }).data)
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

export function useQsTable(): QsEntry[] {
  const [rows, setRows] = useState<QsEntry[]>([]);
  useEffect(() => {
    let live = true;
    loadQsTable().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, []);
  return rows;
}

/** "QS 1001-1200", "not in QS 2027" or "" for a Sri Lankan university id. */
export function qsLabelFor(universityId: string, table: QsEntry[]): string {
  const e = table.find((x) => x.universityId === universityId);
  if (!e) return "";
  return e.qsStatus === "ranked" ? `QS ${e.qsRank}` : "not in QS 2027";
}
