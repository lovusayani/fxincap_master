import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

interface ChartContainerProps {
  symbol: string;
  children?: ReactNode;
  density?: "normal" | "expanded";
}

export default function ChartContainer({ symbol, children, density = "normal" }: ChartContainerProps) {
  return (
    <Card className={`flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 ${density === "expanded" ? "min-h-[520px] lg:min-h-0" : "min-h-[420px] md:min-h-[520px] lg:min-h-0"}`}>
      <CardContent className="flex h-full flex-1 flex-col p-0">
        {children ? (
          <div className="flex h-full flex-1">{children}</div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="text-center">
              <p className="text-sm font-medium text-white">Chart Container</p>
              <p className="mt-2 text-sm text-gray-400">Chart placeholder for {symbol}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}