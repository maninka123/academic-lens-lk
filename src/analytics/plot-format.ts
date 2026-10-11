export const plotNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "")
    return "Not available";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("en", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "Not available";
};
// Apply display precision only; calculations retain their original precision.
export function formatPlot(option: any) {
  const axis = (a: any) =>
    !a
      ? a
      : {
          ...a,
          axisLabel: {
            ...a.axisLabel,
            ...(["value", "log"].includes(a.type) && !a.axisLabel?.formatter
              ? { formatter: plotNumber }
              : {}),
          },
        };
  const axes = (a: any) => (Array.isArray(a) ? a.map(axis) : axis(a));
  return {
    ...option,
    xAxis: axes(option.xAxis),
    yAxis: axes(option.yAxis),
    tooltip: { confine: true, valueFormatter: plotNumber, ...option.tooltip },
    series: option.series?.map((s: any) => ({
      ...s,
      tooltip: { valueFormatter: plotNumber, ...s.tooltip },
      label: {
        ...s.label,
        ...(!s.label?.formatter
          ? { formatter: (p: any) => plotNumber(p.value) }
          : {}),
      },
    })),
  };
}
