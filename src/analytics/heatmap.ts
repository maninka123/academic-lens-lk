// One look for every heatmap: a single indigo ramp, white gaps between cells,
// and label colour chosen from the cell shade so numbers are always readable.
export const HEAT_RAMP = ["#eef1fb", "#a9b8f2", "#4a5fd9", "#1f2d8f"];
const INK = "#18203a";
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
