import { expect, it } from "vitest";
import { formatPlot, plotNumber } from "./plot-format";
it("formats displayed plot values to one decimal without changing source values", () => {
  const option = formatPlot({
    xAxis: { type: "value" },
    series: [{ type: "bar", data: [12.34567] }],
  });
  expect(option.xAxis.axisLabel.formatter(12.34567)).toBe("12.3");
  expect(option.series[0].data).toEqual([12.34567]);
  expect(plotNumber(12)).toBe("12.0");
  expect(plotNumber(null)).toBe("Not available");
});
