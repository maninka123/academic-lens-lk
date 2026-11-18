// One look for every heatmap: a single indigo ramp, white gaps between cells,
// and label colour chosen from the cell shade so numbers are always readable.
export const HEAT_RAMP = ["#eceffd", "#b1baf8", "#5d6cf0", "#2b3aa8"];
/** Dark-mode ramp: low values sink into the surface, high values glow. */
export const HEAT_RAMP_DARK = ["#171c33", "#2f3a86", "#5d6cf0", "#aab4fb"];
const INK = "#0b1020";
const LIGHT = "#ffffff";

/** Label colour for a cell holding `share` (0–100) of the scale maximum. */
export const heatLabelColor = (share: number) => (share >= 52 ? LIGHT : INK);

/** A heatmap datum: [x, y, share] plus its own readable label colour. */
export function heatDatum<T extends Record<string, unknown>>(
  x: number,
  y: number,
  share: number,
  extra: T,
) {
  return {
    value: [x, y, share] as [number, number, number],
    label: { show: true, color: heatLabelColor(share), fontSize: 13, fontWeight: 600 },
    ...extra,
  };
}

export const heatVisualMap = (max = 100, text?: [string, string]) => ({
  min: 0,
  max,
  calculable: false,
  orient: "horizontal" as const,
  left: "center",
  bottom: 4,
  itemWidth: 14,
  itemHeight: 220,
  inRange: { color: HEAT_RAMP },
  text,
  textStyle: { fontSize: 12 },
});

/** Re-colours a heatmap option for dark mode (ramp and per-cell label colours). */
export function heatForDark(option: any) {
  const vm = option.visualMap;
  const darkMap = (v: any) =>
    v?.inRange?.color === HEAT_RAMP ? { ...v, inRange: { ...v.inRange, color: HEAT_RAMP_DARK } } : v;
  return {
    ...option,
    visualMap: Array.isArray(vm) ? vm.map(darkMap) : darkMap(vm),
    series: option.series?.map((s: any) =>
      s.type === "heatmap" && Array.isArray(s.data)
        ? {
            ...s,
            data: s.data.map((d: any) => {
              const share = d?.value?.[2];
              return typeof share === "number" && d.label
                ? { ...d, label: { ...d.label, color: share >= 70 ? INK : "#e8ebf7" } }
                : d;
            }),
          }
        : s,
    ),
  };
}
