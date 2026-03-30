import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const dailyData = [
    { label: "09:00", value: 9800 },
    { label: "11:00", value: 10120 },
    { label: "13:00", value: 9960 },
    { label: "15:00", value: 10340 },
    { label: "17:00", value: 10520 },
    { label: "19:00", value: 10490 },
];

const weeklyData = [
    { label: "Mon", value: 9400 },
    { label: "Tue", value: 9620 },
    { label: "Wed", value: 9780 },
    { label: "Thu", value: 10020 },
    { label: "Fri", value: 10260 },
    { label: "Sat", value: 10180 },
    { label: "Sun", value: 10410 },
];

const monthlyData = [
    { label: "W1", value: 9000 },
    { label: "W2", value: 9525 },
    { label: "W3", value: 9910 },
    { label: "W4", value: 10450 },
];

function DemoChart({ data }: { data: Array<{ label: string; value: number }> }) {
    return (
        <div className="h-64 rounded-2xl border border-white/10 bg-gradient-to-br from-red-600/10 via-slate-900/40 to-orange-500/10 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                        cursor={{ stroke: "rgba(248,113,113,0.5)", strokeWidth: 1 }}
                        contentStyle={{
                            background: "rgba(2,6,23,0.92)",
                            border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: "12px",
                            color: "#f8fafc",
                        }}
                        formatter={(value) => [`$${value}`, "Equity"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2.5} fill="url(#portfolioFill)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function ChartCard() {
    return (
        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">Portfolio Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <Tabs defaultValue="daily" className="w-full">
                    <TabsList>
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                        <TabsTrigger value="weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    </TabsList>
                    <TabsContent value="daily">
                        <DemoChart data={dailyData} />
                    </TabsContent>
                    <TabsContent value="weekly">
                        <DemoChart data={weeklyData} />
                    </TabsContent>
                    <TabsContent value="monthly">
                        <DemoChart data={monthlyData} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
