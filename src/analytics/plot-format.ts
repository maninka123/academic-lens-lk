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
const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
/**
 * Plain "Title\nLabel: value" tooltips become a structured card: bold title,
 * label/value rows, and muted notes. Strings already containing markup pass through.
 */
export function tooltipHtml(text: string) {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "";
  const [title, ...rest] = lines;
  const rows = rest
    .map((line) => {
      const i = line.indexOf(": ");
      return i > 0 && i < 40
        ? `<div class="tip-row"><span>${escapeHtml(line.slice(0, i))}</span><b>${escapeHtml(line.slice(i + 2))}</b></div>`
        : `<div class="tip-note">${escapeHtml(line)}</div>`;
    })
    .join("");
  return `<div class="tip"><div class="tip-title">${escapeHtml(title)}</div>${rows}</div>`;
}
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
    tooltip: {
      confine: true,
      valueFormatter,
      backgroundColor: surface,
      borderColor: border,
      padding: [12, 14],
      textStyle: { color: ink, fontSize: 14 },
      extraCssText: "border-radius:14px;box-shadow:0 12px 32px -8px rgba(15,23,60,.28);",
      ...option.tooltip,
      renderMode: "html",
      ...(typeof option.tooltip?.formatter === "function"
        ? { formatter: (...args: unknown[]) => { const out = option.tooltip.formatter(...args); return typeof out === "string" ? tooltipHtml(out) : out; } }
        : {}),
    },
    series: option.series?.map((s: any) => ({
      ...s,
      ...(s.type === "heatmap"
        ? {
            itemStyle: { borderColor: surface, borderWidth: 3, borderRadius: 6, ...s.itemStyle },
            emphasis: { itemStyle: { borderColor: ink, borderWidth: 2 }, ...s.emphasis },
          }
        : {}),
      tooltip: {
        valueFormatter,
        ...s.tooltip,
        ...(typeof s.tooltip?.formatter === "function"
          ? { formatter: (...args: unknown[]) => { const out = s.tooltip.formatter(...args); return typeof out === "string" ? tooltipHtml(out) : out; } }
          : {}),
      },
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
