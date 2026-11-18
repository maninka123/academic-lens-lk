import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig, emptyFilters, useAtlas } from ".";
import { selectableMetricLabels } from "../types";

afterEach(() => {
  localStorage.clear();
  useAtlas.setState({ filters: emptyFilters(), config: { ...defaultConfig } });
});

describe("comparison session defaults", () => {
  it("starts a new session without saved filters or selected groups", async () => {
    localStorage.setItem(
      "academic-atlas-v1",
      JSON.stringify({
        state: {
          filters: {
            ...emptyFilters(),
            universities: ["colombo"],
            query: "someone",
          },
          config: {
            ...defaultConfig,
            groups: ["colombo"],
            metric: "experience",
            xMetric: "phdYear",
            peer: "experience",
          },
        },
        version: 0,
      }),
    );
    await useAtlas.persist.rehydrate();
    const { filters, config } = useAtlas.getState();
    expect(filters).toEqual(emptyFilters());
    expect(config.groups).toEqual([]);
    expect(config.metric).toBe(defaultConfig.metric);
    expect(config.xMetric).toBe(defaultConfig.xMetric);
    expect(config.peer).toBe(defaultConfig.peer);
  });

  it("keeps a filter the user explicitly selects during the session", () => {
    useAtlas.getState().setFilters({ universities: ["colombo"] });
    expect(useAtlas.getState().filters.universities).toEqual(["colombo"]);
  });

  it("does not offer unsupported measurements or accept stale configuration", () => {
    expect(selectableMetricLabels).not.toHaveProperty("experience");
    expect(selectableMetricLabels).not.toHaveProperty("phdYear");
    useAtlas.getState().configure({ metric: "experience", xMetric: "phdYear" });
    expect(useAtlas.getState().config.metric).toBe(defaultConfig.metric);
    expect(useAtlas.getState().config.xMetric).toBe(defaultConfig.xMetric);
  });
});
