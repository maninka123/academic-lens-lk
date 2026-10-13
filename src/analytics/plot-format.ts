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
export function formatPlot(option: any, theme: "light" | "dark" = "light") {
  const ink = theme === "dark" ? "#e7e7e7" : "#29292d";
  const muted = theme === "dark" ? "#adadad" : "#64646c";
  const border = theme === "dark" ? "#343434" : "#dedee3";
  const surface = theme === "dark" ? "#161616" : "#ffffff";
  const percentage = [option.xAxis, option.yAxis].flat().some((a) =>
    /percent|share|coverage/i.test(a?.name || ""),
  );
  const valueFormatter = (value: unknown) => plotNumber(value, percentage ? 1 : undefined);
  const axis = (a: any) =>
    !a
      ? a
      : {
          ...a,
          nameTextStyle: { color: muted, fontSize: 14, ...a.nameTextStyle },
          axisLine: { ...a.axisLine, lineStyle: { color: border, ...a.axisLine?.lineStyle } },
          splitLine: { ...a.splitLine, lineStyle: { color: border, opacity: .65, ...a.splitLine?.lineStyle } },
          axisLabel: {
            color: muted,
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
    textStyle: { color: ink, fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", fontSize: 14, ...option.textStyle },
    legend: { ...option.legend, textStyle: { color: muted, fontSize: 14, ...option.legend?.textStyle } },
    xAxis: axes(option.xAxis),
    yAxis: axes(option.yAxis),
    tooltip: { confine: true, valueFormatter, backgroundColor: surface, borderColor: border, padding: [10, 14], textStyle: { color: ink, fontSize: 14 }, ...option.tooltip },
    series: option.series?.map((s: any) => ({
      ...s,
      tooltip: { valueFormatter, ...s.tooltip },
      label: {
        color: ink,
        ...s.label,
        fontSize: Math.max(14, s.label?.fontSize || 14),
        ...(!s.label?.formatter
          ? { formatter: (p: any) => valueFormatter(p.value) }
          : {}),
      },
      ...(s.markLine ? { markLine: { ...s.markLine, data: s.markLine.data?.map((line: any) => ({ ...line, label: { color: ink, backgroundColor: surface, ...line.label, ...(line.referenceNames ? { color: ink, backgroundColor: surface } : {}) } })) } } : {}),
    })),
  };
}
