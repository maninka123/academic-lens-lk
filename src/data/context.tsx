import { createContext, useContext } from "react";
import type { Dataset, University } from "../types";
export const DataContext = createContext<Dataset | null>(null);
export function useData() {
  const d = useContext(DataContext);
  if (!d) throw Error("Data context missing");
  return d;
}

/** Institutions that take part in comparisons (those with too little public data are listed but excluded). */
export const comparableUniversities = (universities: University[]) => universities.filter((u) => !u.excludeFromComparison);
/** Every collected profile, including institutions that are not used in comparisons. */
export const directoryAcademics = (d: Dataset) => d.allAcademics ?? d.academics;
