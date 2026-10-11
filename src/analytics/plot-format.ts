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
export const plotTick = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(1);
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
            fontSize: Math.max(14, a.axisLabel?.fontSize || 14),
            ...(["value", "log"].includes(a.type) && !a.axisLabel?.formatter
              ? { formatter: plotTick }
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
        fontSize: Math.max(14, s.label?.fontSize || 14),
        ...(!s.label?.formatter
          ? { formatter: (p: any) => plotNumber(p.value) }
          : {}),
      },
    })),
  };
}
