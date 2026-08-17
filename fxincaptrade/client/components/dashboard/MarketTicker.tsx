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

// `updatedAt` is still accepted (and still drives the caller's refresh) but is
// no longer rendered — the "Source: CoinGecko. Last update …" line was removed.
export function MarketTicker({ symbols, prices }: MarketTickerProps) {
    const scrollingSymbols = [...symbols, ...symbols];

    return (
        <Card className="overflow-hidden rounded-xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardContent className="flex flex-col gap-2 p-2.5">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Live Market Rates</p>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black/60 to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black/60 to-transparent" />

                    <div className="ticker-track flex w-max gap-2 px-2 py-2">
                        {scrollingSymbols.map((symbol, index) => (
                            <div key={`${symbol.id}-${index}`} className="w-[150px] shrink-0 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5">
                                <p className={`text-[10px] uppercase tracking-[0.16em] ${symbol.tone}`}>{symbol.label}</p>
                                <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-white">{formatUsd(prices[symbol.id] ?? null)}</p>
                                <p className="text-[10px] text-gray-500">{symbol.pair}</p>
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