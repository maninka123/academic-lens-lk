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
  benchmarks: false,
  providerMode: "single",
  provider: "Google Scholar",
};
type State = {
  theme: "light" | "dark";
  filters: Filters;
  config: Config;
  pinned: string[];
  custom: CustomGroup[];
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
      theme: "light",
      filters: emptyFilters(),
      config: defaultConfig,
      pinned: [],
      custom: [],
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
          if (!Object.hasOwn(metricLabels, config.metric))
            config.metric = defaultConfig.metric;
          if (!Object.hasOwn(levelLabels, config.level))
            config.level = defaultConfig.level;
          if (
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
            ].includes(config.chart)
          )
            config.chart = "bar";
          if (
            !Object.hasOwn(metricLabels, config.xMetric) ||
            ["count", "phd", "overseas"].includes(config.xMetric)
          )
            config.xMetric = "publications";
          if (!["pooled", "equal"].includes(config.weight))
            config.weight = "pooled";
          if (!["name", "value"].includes(config.sort)) config.sort = "name";
          config.groups = Array.isArray(config.groups)
            ? config.groups.filter((g) => typeof g === "string")
            : [];
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
          if (
            !["bar", "scatter", "bubble"].includes(config.chart) ||
            ["count", "phd", "overseas"].includes(config.metric)
          )
            config.log = false;
          if (
            config.aggregation === "distribution" &&
            !["box", "histogram", "scatter", "bubble"].includes(config.chart)
          )
            config.aggregation = "median";
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
        set((s) => ({
          custom: s.custom.filter((g) => g.id !== id),
          config: {
            ...s.config,
            groups: s.config.groups.filter((g) => g !== id),
          },
        })),
      restore: (s) => set(s),
    }),
    {
      name: "academic-atlas-v1",
      merge: (persisted, current) => {
        const p = (
          persisted && typeof persisted === "object" ? persisted : {}
        ) as Partial<State>;
        const f = emptyFilters();
        for (const k of Object.keys(f) as (keyof Filters)[]) {
          const v = p.filters?.[k];
          if (["query", "interest"].includes(k)) {
            if (typeof v === "string") (f as any)[k] = v;
          } else if (
            ["experience", "phdYear", "citations", "publications"].includes(k)
          ) {
            if (
              Array.isArray(v) &&
              v.length === 2 &&
              v.every(
                (n) =>
                  n === null ||
                  (typeof n === "number" && Number.isFinite(n) && n >= 0),
              )
            )
              (f as any)[k] = v;
          } else if (Array.isArray(v))
            (f as any)[k] = v.filter((x) => typeof x === "string");
        }
        return {
          ...current,
          theme: p.theme === "dark" ? "dark" : "light",
          filters: f,
          config: {
            ...defaultConfig,
            ...(p.config && typeof p.config === "object" ? p.config : {}),
          },
          pinned: Array.isArray(p.pinned)
            ? [...new Set(p.pinned.filter((x) => typeof x === "string"))]
            : [],
          custom: Array.isArray(p.custom)
            ? p.custom.filter(
                (g) =>
                  g &&
                  typeof g.id === "string" &&
                  typeof g.name === "string" &&
                  Array.isArray(g.ids) &&
                  g.ids.every((id) => typeof id === "string"),
              )
            : [],
        };
      },
    },
  ),
);
export function encodeState() {
  const s = useAtlas.getState();
  return JSON.stringify({
    v: 1,
    mode: "real",
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
      s.mode !== "real" ||
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
            v === null ||
            (typeof v === "number" && Number.isFinite(v) && v >= 0),
        )
      )
        throw Error("Invalid range");
    const c = { ...defaultConfig, ...s.config };
    if (!validModes(c.metric).includes(c.aggregation))
      c.aggregation = validModes(c.metric)[0];
    if (
      !Object.hasOwn(metricLabels, c.xMetric) ||
      ["count", "phd", "overseas"].includes(c.xMetric)
    )
      c.xMetric = defaultConfig.xMetric;
    if (!["pooled", "equal"].includes(c.weight)) c.weight = "pooled";
    if (!["name", "value"].includes(c.sort)) c.sort = "name";
    c.groups = c.groups.filter((g: unknown) => typeof g === "string");
    c.log = Boolean(c.log);
    c.labels = Boolean(c.labels);
    c.benchmarks = Boolean(c.benchmarks);
    if (c.providerMode !== "mixed") c.providerMode = "single";
    if (!["Google Scholar", "ResearchGate", "OpenAlex"].includes(c.provider || ""))
      c.provider = "Google Scholar";
    useAtlas.getState().restore({
      filters: f,
      config: c,
      pinned: [
        ...new Set(s.pinned.filter((x: unknown) => typeof x === "string")),
      ] as string[],
      custom: s.custom.filter(
        (g: CustomGroup) =>
          g &&
          typeof g.id === "string" &&
          typeof g.name === "string" &&
          Array.isArray(g.ids) &&
          g.ids.every((id) => typeof id === "string"),
      ),
    });
    useAtlas.getState().configure({});
    sessionStorage.removeItem("atlas-share-error");
  } catch {
    sessionStorage.setItem(
      "atlas-share-error",
      "The shared configuration could not be loaded. Your existing controls remain available.",
    );
  }
}
