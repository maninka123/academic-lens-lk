import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Config, Filters, CustomGroup } from "../types";
import { metricLabels, levelLabels } from "../types";
import { validModes } from "../analytics/engine";
export const emptyFilters = (): Filters => ({
  types: [],
  universities: [],
  faculties: [],
  departments: [],
  ranks: [],
  qualifications: [],
  countries: [],
  fields: [],
  query: "",
  interest: "",
  experience: [null, null],
  phdYear: [null, null],
  citations: [null, null],
  publications: [null, null],
});
export const defaultConfig: Config = {
  level: "university",
  metric: "citations",
  aggregation: "median",
  chart: "bar",
  weight: "pooled",
  groups: [],
  peer: "current",
  xMetric: "publications",
  log: false,
  labels: false,
  sort: "name",
};
type State = {
  mode: "real" | "demo";
  theme: "light" | "dark";
  filters: Filters;
  config: Config;
  pinned: string[];
  custom: CustomGroup[];
  setMode: (m: "real" | "demo") => void;
  setTheme: () => void;
  setFilters: (f: Partial<Filters>) => void;
  clear: () => void;
  configure: (c: Partial<Config>) => void;
  pin: (id: string) => void;
  unpin: (id: string) => void;
  saveGroup: (g: CustomGroup) => void;
  deleteGroup: (id: string) => void;
  restore: (s: Partial<State>) => void;
};
export const useAtlas = create<State>()(
  persist(
    (set) => ({
      mode: "real",
      theme: "light",
      filters: emptyFilters(),
      config: defaultConfig,
      pinned: [],
      custom: [],
      setMode: (mode) =>
        set({
          mode,
          filters: emptyFilters(),
          pinned: [],
          custom: [],
          config: defaultConfig,
        }),
      setTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setFilters: (f) =>
        set((s) => ({
          filters: { ...s.filters, ...f },
          config: { ...s.config, groups: [] },
        })),
      clear: () => set({ filters: emptyFilters() }),
      configure: (c) =>
        set((s) => {
          const config = { ...s.config, ...c };
          if (!validModes(config.metric).includes(config.aggregation))
            config.aggregation = validModes(config.metric)[0];
          if (c.aggregation === "distribution") config.chart = "box";
          if (c.chart === "bar" && config.aggregation === "distribution")
            config.aggregation = "median";
          if (
            ["count", "phd", "overseas"].includes(config.metric) &&
            ["scatter", "bubble", "box", "histogram"].includes(config.chart)
          )
            config.chart = "bar";
          return { config };
        }),
      pin: (id) =>
        set((s) => ({
          pinned: s.pinned.includes(id) ? s.pinned : [...s.pinned, id],
        })),
      unpin: (id) => set((s) => ({ pinned: s.pinned.filter((x) => x !== id) })),
      saveGroup: (g) =>
        set((s) => ({ custom: [...s.custom.filter((x) => x.id !== g.id), g] })),
      deleteGroup: (id) =>
        set((s) => ({ custom: s.custom.filter((g) => g.id !== id) })),
      restore: (s) => set(s),
    }),
    { name: "academic-atlas-v1" },
  ),
);
export function encodeState() {
  const s = useAtlas.getState();
  return JSON.stringify({
    v: 1,
    mode: s.mode,
    filters: s.filters,
    config: s.config,
    pinned: s.pinned,
    custom: s.custom,
  });
}
export function restoreFromUrl() {
  const q = location.hash.split("?")[1];
  const raw = new URLSearchParams(q || "").get("view");
  if (!raw) return;
  try {
    if (raw.length > 40000) throw Error("Configuration too large");
    const s = JSON.parse(raw);
    if (
      s.v !== 1 ||
      !["real", "demo"].includes(s.mode) ||
      !Array.isArray(s.pinned) ||
      !Array.isArray(s.custom) ||
      !s.config ||
      !s.filters
    )
      throw Error("Invalid view");
    if (
      !Object.hasOwn(metricLabels, s.config.metric) ||
      !Object.hasOwn(levelLabels, s.config.level) ||
      ![
        "bar",
        "grouped",
        "stacked",
        "percentStacked",
        "scatter",
        "bubble",
        "box",
        "histogram",
        "heatmap",
        "treemap",
      ].includes(s.config.chart) ||
      !Array.isArray(s.config.groups)
    )
      throw Error("Invalid chart configuration");
    const f = { ...emptyFilters(), ...s.filters };
    for (const key of [
      "types",
      "universities",
      "faculties",
      "departments",
      "ranks",
      "qualifications",
      "countries",
      "fields",
    ])
      if (
        !Array.isArray(f[key]) ||
        !f[key].every((v: unknown) => typeof v === "string")
      )
        throw Error("Invalid filter");
    for (const key of ["query", "interest"])
      if (typeof f[key] !== "string") throw Error("Invalid search");
    for (const key of ["experience", "phdYear", "citations", "publications"])
      if (
        !Array.isArray(f[key]) ||
        f[key].length !== 2 ||
        !f[key].every(
          (v: unknown) =>
            v === null || (typeof v === "number" && Number.isFinite(v)),
        )
      )
        throw Error("Invalid range");
    const c = { ...defaultConfig, ...s.config };
    if (!validModes(c.metric).includes(c.aggregation))
      c.aggregation = validModes(c.metric)[0];
    useAtlas.getState().restore({
      mode: s.mode,
      filters: f,
      config: c,
      pinned: s.pinned.filter((x: unknown) => typeof x === "string"),
      custom: s.custom.filter(
        (g: CustomGroup) => typeof g.name === "string" && Array.isArray(g.ids),
      ),
    });
  } catch {
    sessionStorage.setItem(
      "atlas-share-error",
      "The shared configuration could not be loaded. Default controls are available.",
    );
  }
}
