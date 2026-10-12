export const plotNumber = (value: unknown, decimals?: number) => {
  if (value === null || value === undefined || value === "")
    return "Not available";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("en", {
        minimumFractionDigits: decimals ?? (Number.isInteger(n) ? 0 : 1),
        maximumFractionDigits: 1,
      })
    : "Not available";
};
export const plotTick = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return plotNumber(n);
  if (Math.abs(n) >= 1_000_000) return plotNumber(n / 1_000_000) + "M";
  if (Math.abs(n) >= 1_000) return plotNumber(n / 1_000) + "k";
  return plotNumber(n);
};
// Apply display precision only; calculations retain their original precision.
export function formatPlot(option: any) {
  const percentage = [option.xAxis, option.yAxis].flat().some((a) =>
    /percent|share|coverage/i.test(a?.name || ""),
  );
  const valueFormatter = (value: unknown) => plotNumber(value, percentage ? 1 : undefined);
  const axis = (a: any) =>
    !a
      ? a
      : {
          ...a,
          axisLabel: {
            ...a.axisLabel,
            fontSize: Math.max(14, a.axisLabel?.fontSize || 14),
            ...(["value", "log"].includes(a.type) && !a.axisLabel?.formatter
              ? { formatter: /percent|share|coverage/i.test(a.name || "")
                  ? (v: unknown) => plotNumber(v, 1)
                  : plotTick }
              : {}),
          },
        };
  const axes = (a: any) => (Array.isArray(a) ? a.map(axis) : axis(a));
  return {
    ...option,
    xAxis: axes(option.xAxis),
    yAxis: axes(option.yAxis),
    tooltip: { confine: true, valueFormatter, ...option.tooltip },
    series: option.series?.map((s: any) => ({
      ...s,
      tooltip: { valueFormatter, ...s.tooltip },
      label: {
        ...s.label,
        fontSize: Math.max(14, s.label?.fontSize || 14),
        ...(!s.label?.formatter
          ? { formatter: (p: any) => valueFormatter(p.value) }
          : {}),
      },
    })),
  };
}
