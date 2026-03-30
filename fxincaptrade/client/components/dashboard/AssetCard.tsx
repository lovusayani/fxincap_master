import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const assets = [
    { label: "Spot", value: "$43,200.43" },
    { label: "Futures", value: "$12,010.92" },
    { label: "Fiat", value: "$8,450.00" },
    { label: "Copy Trade", value: "$3,240.11" },
];

export function AssetCard() {
    return (
        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-4">
                        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-8 border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-xs text-gray-300">
                            Donut Chart
                        </div>
                    </div>
                    <div className="col-span-12 md:col-span-8 space-y-2">
                        {assets.map((item) => (
                            <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                <span className="text-sm text-gray-300">{item.label}</span>
                                <span className="text-sm font-semibold text-white">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
