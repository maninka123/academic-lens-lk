import { heatForDark } from "./heatmap";
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
/** Chart ink, from the design tokens (design-system/tokens.css), for the two themes. */
export const chartInk = {
  light: { ink: "#0b1020", muted: "#5f697d", border: "#e2e5ec", surface: "#ffffff", grid: "#e9ecf2" },
  dark: { ink: "#f3f5fa", muted: "#8189a0", border: "#212638", surface: "#0e1220", grid: "#1b2033" },
};
export const CHART_FONT = '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif';
/** Motion: short and purposeful, off for reduced-motion users and for large datasets. */
export const chartMotion = (option: any) => {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const points = (option.series || []).reduce((n: number, s: any) => n + (Array.isArray(s.data) ? s.data.length : 0), 0);
  const on = !reduced && points <= 1500;
  return on
    ? { animation: true, animationDuration: 320, animationDurationUpdate: 320, animationEasing: "cubicOut", animationEasingUpdate: "cubicOut" }
    : { animation: false };
};
// Apply display precision only; calculations retain their original precision.
export function formatPlot(input: any, theme: "light" | "dark" = "light") {
  const option = theme === "dark" && input.series?.some((s: any) => s.type === "heatmap") ? heatForDark(input) : input;
  const { ink, muted, border, surface, grid } = chartInk[theme];
  const percentage = [option.xAxis, option.yAxis].flat().some((a) =>
    /percent|share|coverage/i.test(a?.name || ""),
  );
  const valueFormatter = (value: unknown) => plotNumber(value, percentage ? 1 : undefined);
  const axis = (a: any) =>
    !a
      ? a
      : {
          ...a,
          nameTextStyle: { color: muted, fontSize: 12.5, ...a.nameTextStyle },
          axisLine: { ...a.axisLine, lineStyle: { color: border, ...a.axisLine?.lineStyle } },
          axisTick: { show: false, ...a.axisTick },
          splitLine: { ...a.splitLine, lineStyle: { color: grid, type: "solid", ...a.splitLine?.lineStyle } },
          axisLabel: {
            color: muted,
            ...a.axisLabel,
            fontSize: Math.max(12, Math.min(13, a.axisLabel?.fontSize || 12.5)),
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
    ...chartMotion(option),
    textStyle: { color: ink, fontFamily: CHART_FONT, fontSize: 12.5, ...option.textStyle },
    legend: { itemWidth: 10, itemHeight: 10, itemGap: 16, icon: "roundRect", ...option.legend, textStyle: { color: muted, fontSize: 12.5, ...option.legend?.textStyle } },
    xAxis: axes(option.xAxis),
    yAxis: axes(option.yAxis),
    tooltip: {
      confine: true,
      valueFormatter,
      backgroundColor: surface,
      borderColor: border,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: ink, fontSize: 12.5, fontFamily: CHART_FONT },
      extraCssText: `border-radius:10px;box-shadow:${theme === "dark" ? "0 12px 32px rgba(0,0,0,.55)" : "0 12px 32px rgba(11,16,32,.14)"};`,
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
            itemStyle: { borderColor: surface, borderWidth: 3, borderRadius: 4, ...s.itemStyle },
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
        fontSize: Math.max(12, Math.min(13, s.label?.fontSize || 12.5)),
        ...(!s.label?.formatter
          ? { formatter: (p: any) => valueFormatter(p.value) }
          : {}),
      },
      ...(s.markLine ? { markLine: { ...s.markLine, data: s.markLine.data?.map((line: any) => ({ ...line, label: { color: ink, backgroundColor: surface, ...line.label, ...(line.referenceNames ? { color: ink, backgroundColor: surface } : {}) } })) } } : {}),
    })),
  };
}
