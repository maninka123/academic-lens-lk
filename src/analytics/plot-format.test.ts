import { expect, it } from "vitest";
import { formatPlot, plotNumber, plotTick } from "./plot-format";
it("shows whole counts and one-decimal fractional values without changing source values", () => {
  const option = formatPlot({
    xAxis: { type: "value" },
    series: [{ type: "bar", data: [12.34567] }],
  });
  expect(option.xAxis.axisLabel.formatter(12.34567)).toBe("12.3");
  expect(option.series[0].data).toEqual([12.34567]);
  expect(plotNumber(12)).toBe("12");
  expect(plotTick(12500)).toBe("12,500");
  expect(option.xAxis.axisLabel.formatter(12)).toBe("12");
  expect(option.series[0].label.formatter({ value: 12 })).toBe("12");
  expect(plotNumber(null)).toBe("Not available");
});
it("never renders non-finite or invalid numeric values as NaN", () => {
  for (const value of [NaN, Infinity, -Infinity, "NaN", "invalid"])
    expect(plotNumber(value)).toBe("Not available");
  expect(plotNumber(0)).toBe("0");
});
it("preserves fractional summaries and percentage precision", () => {
  expect(plotNumber(7.5)).toBe("7.5");
  expect(plotNumber(20, 1)).toBe("20.0");
  const option = formatPlot({ yAxis: { type: "value", name: "Percent" } });
  expect(option.yAxis.axisLabel.formatter(100)).toBe("100.0");
  expect(option.tooltip.valueFormatter(20)).toBe("20.0");
});
