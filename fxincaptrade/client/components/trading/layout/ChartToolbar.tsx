import { Button } from "@/components/ui/button";

interface ChartToolbarProps {
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  chartDensity: "normal" | "expanded";
  onChartDensityChange: (density: "normal" | "expanded") => void;
}

const intervals = ["1m", "5m", "15m", "1H", "4H", "1D"];

export default function ChartToolbar({ symbol, interval, onIntervalChange, chartDensity, onChartDensityChange }: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {intervals.map((item) => (
          <Button
            key={item}
            variant="ghost"
            onClick={() => onIntervalChange(item)}
            className={`h-8 rounded-lg border px-3 text-xs border-white/10 text-gray-300 hover:bg-white/10 ${interval === item ? "bg-white/10" : "bg-white/5"}`}
          >
            {item}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={() => onChartDensityChange(chartDensity === "expanded" ? "normal" : "expanded")}
          className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10"
        >
          {chartDensity === "expanded" ? "Normal" : "Expand"}
        </Button>
      </div>
    </div>
  );
}