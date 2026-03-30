import React from "react";
import { Card, CardContent } from "@/components/ui/card";

type TickerSymbol = {
    id: string;
    label: string;
    pair: string;
    tone: string;
};

type TickerPriceMap = Record<string, number | null>;

interface MarketTickerProps {
    symbols: TickerSymbol[];
    prices: TickerPriceMap;
    updatedAt: number | null;
}

function formatUsd(value: number | null) {
    if (value === null) {
        return "Loading...";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(value);
}

export function MarketTicker({ symbols, prices, updatedAt }: MarketTickerProps) {
    const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })
        : "Awaiting live feed";

    const scrollingSymbols = [...symbols, ...symbols];

    return (
        <Card className="overflow-hidden rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardContent className="flex flex-col gap-4 p-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Live Market Rates</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">Source: CoinGecko. Last update {updatedLabel}.</p>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black/60 to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black/60 to-transparent" />

                    <div className="ticker-track flex w-max gap-3 px-3 py-3">
                        {scrollingSymbols.map((symbol, index) => (
                            <div key={`${symbol.id}-${index}`} className="w-[190px] shrink-0 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                                <p className={`text-xs uppercase tracking-[0.18em] ${symbol.tone}`}>{symbol.label}</p>
                                <p className="mt-2 text-2xl font-bold tracking-tight text-white">{formatUsd(prices[symbol.id] ?? null)}</p>
                                <p className="mt-1 text-xs text-gray-500">{symbol.pair}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <style>{`
                    .ticker-track {
                        animation: ticker-scroll 42s linear infinite;
                    }

                    .ticker-track:hover {
                        animation-play-state: paused;
                    }

                    @keyframes ticker-scroll {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                `}</style>
            </CardContent>
        </Card>
    );
}