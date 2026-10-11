import { createContext, useContext } from "react";
import type { Dataset } from "../types";
export const DataContext = createContext<Dataset | null>(null);
export function useData() {
  const d = useContext(DataContext);
  if (!d) throw Error("Data context missing");
  return d;
}
