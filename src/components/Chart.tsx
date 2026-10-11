import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  TreemapChart,
  PieChart,
  MapChart,
  SankeyChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  TitleComponent,
  MarkLineComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Download, FileSpreadsheet, Maximize2, Minimize2 } from "lucide-react";
import { useAtlas } from "../store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { formatPlot } from "../analytics/plot-format";
echarts.use([
  BarChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  TreemapChart,
  PieChart,
  MapChart,
  SankeyChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  TitleComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
]);
export { echarts };
function ChartCanvas({
  option,
  height = 380,
  onClick,
  label = "Chart. Use the nearby heading and supporting values for context.",
  minWidth,
  full,
  setFull,
  exportStats,
}: {
  option: any;
  height?: number;
  onClick?: (p: any) => void;
  label?: string;
  minWidth?: number;
  full: boolean;
  setFull: (v: boolean) => void;
  exportStats?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    instance = useRef<echarts.ECharts | null>(null);
  const theme = useAtlas((s) => s.theme);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(
      ref.current,
      theme === "dark" ? "dark" : undefined,
    );
    instance.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, [theme, full]);
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    chart.setOption(
      {
        backgroundColor: "transparent",
        animation: false,
        textStyle: {
          fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
          fontSize: 15,
        },
        aria: { enabled: true, description: label },
        ...formatPlot(option),
      },
      true,
    );
    chart.off("click");
    if (onClick) chart.on("click", onClick);
  }, [option, onClick, theme, full, label]);
  useEffect(() => {
    instance.current?.resize();
  }, [full]);
  function save() {
    const url = instance.current?.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: theme === "dark" ? "#14283a" : "#fff",
    });
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "academic-atlas-chart.png";
      a.click();
    }
  }
  const content = (
    <div className="chart-body">
      <div className="chart-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Export chart as PNG"
          onClick={save}
        >
          <Download size={18} />
        </Button>
        {exportStats && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Export chart with supporting statistics"
            title="Export chart (PNG) with supporting statistics (CSV)"
            onClick={() => {
              save();
              exportStats();
            }}
          >
            <FileSpreadsheet size={18} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={full ? "Close expanded chart" : "Expand chart"}
          onClick={() => setFull(!full)}
        >
          {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Button>
      </div>
      <div
        ref={ref}
        role="img"
        aria-label={label}
        style={{
          height: full ? "70vh" : height,
          width: "100%",
          minWidth:
            minWidth ??
            (option.series?.some((s: any) => s.type === "heatmap") ? 850 : 0),
        }}
      />
    </div>
  );
  return content;
}
export function Chart(props: {
  option: any;
  height?: number;
  onClick?: (p: any) => void;
  label?: string;
  minWidth?: number;
  /** Adds an action that saves the chart together with its statistics CSV. */
  exportStats?: () => void;
}) {
  const [full, setFull] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const wasFull = useRef(false);
  useEffect(() => {
    if (wasFull.current && !full)
      wrap.current
        ?.querySelector<HTMLButtonElement>('[aria-label="Expand chart"]')
        ?.focus();
    wasFull.current = full;
  }, [full]);
  const canvas = <ChartCanvas {...props} full={full} setFull={setFull} />;
  return (
    <div className="chart-wrap" ref={wrap}>
      {full ? (
        <Dialog
          className="chart-dialog"
          open={full}
          onOpenChange={setFull}
          title={props.label || "Expanded chart"}
        >
          {canvas}
        </Dialog>
      ) : (
        canvas
      )}
    </div>
  );
}
