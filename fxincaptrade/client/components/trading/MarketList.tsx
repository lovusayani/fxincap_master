import React, { useMemo, useState } from "react";
import { Search, Star, ChevronDown } from "lucide-react";
import type { PriceTick } from "@/hooks/useMarketStream";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MarketListProps {
    active?: string;
    onSelect?: (symbol: string) => void;
    prices?: Record<string, PriceTick>;
}

const SYMBOLS_BY_CATEGORY = {
    FX: [
        { code: "EURUSD", name: "Euro / US Dollar", bid: "1.17380", ask: "1.17385", change: "+0.45%" },
        { code: "GBPUSD", name: "British Pound / US Dollar", bid: "1.26450", ask: "1.26455", change: "-0.12%" },
        { code: "USDJPY", name: "US Dollar / Japanese Yen", bid: "149.850", ask: "149.860", change: "+1.23%" },
    ],
    Crypto: [
        { code: "BTCUSDT", name: "Bitcoin / US Dollar", bid: "42150.50", ask: "42160.00", change: "+2.34%" },
        { code: "ETHUSDT", name: "Ethereum / US Dollar", bid: "2245.80", ask: "2246.50", change: "+1.89%" },
    ],
    Commodities: [
        { code: "XAUUSD", name: "Gold / US Dollar", bid: "2087.50", ask: "2088.00", change: "+0.23%" },
        { code: "XAGUSD", name: "Silver / US Dollar", bid: "27.45", ask: "27.48", change: "+0.45%" },
    ],
};

const normalizeSymbolCode = (code: string) => {
    const normalized = String(code || "").toUpperCase();
    if (normalized === "BTCUSD") return "BTCUSDT";
    if (normalized === "ETHUSD") return "ETHUSDT";
    return normalized;
};

export default function MarketList({ active, onSelect, prices = {} }: MarketListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"all" | "favorites">("all");
    const [favorites, setFavorites] = useState<string[]>(
        JSON.parse(localStorage.getItem("market_favorites") || '["EURUSD","GBPUSD","XAUUSD"]').map((code: string) => normalizeSymbolCode(code))
    );
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        FX: true,
        Crypto: true,
        Commodities: true,
    });

    const toggleFavorite = (code: string) => {
        const normalizedCode = normalizeSymbolCode(code);
        const updated = favorites.includes(normalizedCode)
            ? favorites.filter((f) => f !== normalizedCode)
            : [...favorites, normalizedCode];
        setFavorites(updated);
        localStorage.setItem("market_favorites", JSON.stringify(updated));
    };

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const out: Record<string, typeof SYMBOLS_BY_CATEGORY.FX> = {};
        Object.entries(SYMBOLS_BY_CATEGORY).forEach(([category, rows]) => {
            const searchedRows = rows.filter((s) =>
                !query || s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
            );
            out[category] = searchedRows.filter((s) =>
                viewMode === "all" ? true : favorites.includes(normalizeSymbolCode(s.code))
            );
        });
        return out;
    }, [favorites, searchQuery, viewMode]);

    const favoriteCount = favorites.length;
    const hasVisibleRows = Object.values(filtered).some((rows) => rows.length > 0);

    return (
        <div className="h-full flex flex-col bg-[#0f101a] text-white">
            <div className="space-y-3 p-3 border-b border-white/10">
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "all" | "favorites")}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="all">All Symbols</TabsTrigger>
                        <TabsTrigger value="favorites">Favorites {favoriteCount > 0 ? `(${favoriteCount})` : ""}</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search symbols"
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-400/50"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!hasVisibleRows && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-400">
                        {viewMode === "favorites" ? "No favorite symbols yet." : "No symbols matched your search."}
                    </div>
                )}
                {Object.entries(filtered).map(([category, rows]) => (
                    rows.length > 0 ? <div key={category} className="rounded-lg border border-white/10 overflow-hidden">
                        <button
                            onClick={() => setExpandedCategories((p) => ({ ...p, [category]: !p[category] }))}
                            className="w-full px-3 py-2 bg-white/5 text-left text-xs uppercase tracking-wide flex items-center"
                        >
                            <span className="flex-1">{category}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedCategories[category] ? "rotate-180" : ""}`} />
                        </button>
                        {expandedCategories[category] && (
                            <div>
                                {rows.map((item) => {
                                    const normalizedActive = normalizeSymbolCode(active || "");
                                    const normalizedCode = normalizeSymbolCode(item.code);
                                    const selected = normalizedCode === normalizedActive;
                                    const live = prices[normalizedCode];
                                    const displayBid = live ? live.bid.toFixed(live.bid > 100 ? 2 : 5) : item.bid;
                                    const displayChange = live ? live.change : item.change;
                                    const isNeg = displayChange.startsWith("-");
                                    return (
                                        <button
                                            key={item.code}
                                            onClick={() => onSelect?.(normalizedCode)}
                                            className={`w-full px-3 py-2 text-left border-t border-white/5 transition ${selected ? "bg-cyan-500/15" : "hover:bg-white/5"}`}
                                        >
                                            <div className="flex items-center">
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold">{item.code}</div>
                                                    <div className="text-[11px] text-gray-400">{item.name}</div>
                                                </div>
                                                <div className="text-right mr-2">
                                                    <div className="text-xs font-mono">{displayBid}</div>
                                                    <div className={`text-[11px] ${isNeg ? "text-red-400" : "text-emerald-400"}`}>
                                                        {displayChange}
                                                    </div>
                                                </div>
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(item.code);
                                                    }}
                                                >
                                                    <Star className={`w-4 h-4 ${favorites.includes(normalizedCode) ? "fill-yellow-400 text-yellow-400" : "text-gray-500"}`} />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div> : null
                ))}
            </div>
        </div>
    );
}
