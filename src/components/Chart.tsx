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
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { useAtlas } from "../store";
import { Button } from "./ui/button";
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
export function Chart({
  option,
  height = 380,
  onClick,
  label = "Interactive chart",
}: {
  option: any;
  height?: number;
  onClick?: (p: any) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    instance = useRef<echarts.ECharts | null>(null);
  const [full, setFull] = useState(false);
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
  }, [theme]);
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
        aria: { enabled: true },
        ...option,
      },
      true,
    );
    chart.off("click");
    if (onClick) chart.on("click", onClick);
  }, [option, onClick, theme]);
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
  return (
    <div className={full ? "chart-wrap expanded" : "chart-wrap"}>
      <div className="chart-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Export chart as PNG"
          onClick={save}
        >
          <Download size={18} />
        </Button>
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
        style={{ height: full ? "80vh" : height, width: "100%" }}
      />
    </div>
  );
}
