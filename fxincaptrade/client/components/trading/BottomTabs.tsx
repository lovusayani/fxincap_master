import React, { useCallback, useEffect, useState } from "react";
import type { PriceTick } from "@/hooks/useMarketStream";

interface Position {
    id: string;
    symbol: string;
    side: string;
    volume: number;
    entryPrice: number;
    pnl: number;
    status: string;
}

interface Order {
    id: string;
    symbol: string;
    side: string;
    type: string;
    volume: number;
    price: number;
    status: string;
    createdAt: string;
}

interface HistoryRow {
    id: string;
    symbol: string;
    side: string;
    volume: number;
    openPrice: number;
    closePrice: number;
    profit: number;
    closeTime: string;
}

interface BottomTabsProps {
    prices?: Record<string, PriceTick>;
    refreshKey?: number;
    onTradeClosed?: () => void;
}

function calcLivePnL(
    symbol: string,
    side: string,
    entryPrice: number,
    volume: number,
    currentPrice: number
): number {
    if (!currentPrice || !entryPrice) return 0;
    const direction = side === "BUY" ? 1 : -1;
    const upper = symbol.toUpperCase();
    const contractSize = upper.startsWith("XAU")
        ? 100
        : upper.startsWith("XAG")
            ? 5000
            : 100000;
    return +((currentPrice - entryPrice) * contractSize * volume * direction).toFixed(2);
}

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function BottomTabs({ prices = {}, refreshKey = 0, onTradeClosed }: BottomTabsProps) {
    const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const readErrorMessage = async (res: Response, fallback: string) => {
        const data = await res.json().catch(() => null);
        return data?.error || data?.message || fallback;
    };

    const fetchAll = useCallback(async () => {
        const token = localStorage.getItem("auth_token");
        if (!token) {
            setPositions([]);
            setOrders([]);
            setHistory([]);
            setErrorMessage(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setErrorMessage(null);
        try {
            const [posRes, ordRes, histRes] = await Promise.all([
                fetch("/api/trades/open", { headers: authHeaders() }),
                fetch("/api/orders", { headers: authHeaders() }),
                fetch("/api/history?limit=10", { headers: authHeaders() }),
            ]);
            const requestErrors: string[] = [];
            if (posRes.ok) {
                const d = await posRes.json();
                const raw: any[] = Array.isArray(d) ? d : (d.trades ?? []);
                setPositions(raw.map((t: any) => ({
                    id: String(t.id ?? t.trade_id),
                    symbol: t.symbol,
                    side: (t.side ?? "").toUpperCase(),
                    volume: parseFloat(t.volume),
                    entryPrice: parseFloat(t.entry_price ?? t.entryPrice ?? 0),
                    pnl: parseFloat(t.pnl ?? 0),
                    status: t.status ?? "OPEN",
                })));
            } else {
                requestErrors.push(`Positions: ${await readErrorMessage(posRes, "failed to load")}`);
            }
            if (ordRes.ok) {
                const d = await ordRes.json();
                const raw: any[] = Array.isArray(d) ? d : (d.orders ?? []);
                setOrders(raw.map((ord: any) => ({
                    id: String(ord.id),
                    symbol: ord.symbol,
                    side: (ord.side ?? "").toUpperCase(),
                    type: ord.type,
                    volume: parseFloat(ord.volume),
                    price: parseFloat(ord.price),
                    status: ord.status,
                    createdAt: ord.createdAt,
                })));
            } else {
                requestErrors.push(`Orders: ${await readErrorMessage(ordRes, "failed to load")}`);
            }
            if (histRes.ok) {
                const d = await histRes.json();
                const raw: any[] = Array.isArray(d) ? d : (d.history ?? []);
                setHistory(raw.slice(0, 10).map((t: any) => ({
                    id: String(t.id),
                    symbol: t.symbol,
                    side: (t.side ?? "").toUpperCase(),
                    volume: parseFloat(t.volume),
                    openPrice: parseFloat(t.entry_price ?? t.entryPrice ?? t.open_price ?? 0),
                    closePrice: parseFloat(t.exit_price ?? t.exitPrice ?? t.close_price ?? 0),
                    profit: parseFloat(t.profit_loss ?? t.profitLoss ?? t.profit ?? 0),
                    closeTime: t.exit_time ?? t.exitTime ?? t.close_time ?? t.closeTime ?? "",
                })));
            } else {
                requestErrors.push(`History: ${await readErrorMessage(histRes, "failed to load")}`);
            }
            setErrorMessage(requestErrors.length > 0 ? requestErrors.join(" | ") : null);
        } catch (error) {
            console.error("Error fetching trading panels:", error);
            setErrorMessage("Could not refresh positions, orders, or history. Showing the last loaded data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll, refreshKey]);

    const closePosition = async (positionId: string, symbol: string, side: string) => {
        try {
            const live = prices[symbol];
            const closePrice = side === "SELL" ? (live?.ask ?? 0) : (live?.bid ?? 0);
            if (closePrice <= 0) {
                setErrorMessage(`No live ${side === "SELL" ? "ask" : "bid"} quote is available for ${symbol}.`);
                return;
            }
            const res = await fetch(`/api/trades/${positionId}/close`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ closePrice }),
            });
            if (res.ok) {
                const data = await res.json();
                setErrorMessage(null);
                console.log("✓ Position closed:", positionId, "P/L:", data.finalPnL);
                onTradeClosed?.();
                fetchAll(); // Refresh to show updated positions/history
            } else {
                const message = await readErrorMessage(res, "Failed to close position");
                setErrorMessage(message);
                console.error("Failed to close position:", message);
            }
        } catch (error) {
            setErrorMessage("Error closing position. Please try again.");
            console.error("Error closing position:", error);
        }
    };

    const cancelOrder = async (orderId: string) => {
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: "DELETE",
                headers: authHeaders(),
            });
            if (res.ok) {
                setErrorMessage(null);
                console.log("✓ Order cancelled:", orderId);
                fetchAll(); // Refresh to remove cancelled order
            } else {
                const message = await readErrorMessage(res, "Failed to cancel order");
                setErrorMessage(message);
                console.error("Failed to cancel order:", message);
            }
        } catch (error) {
            setErrorMessage("Error cancelling order. Please try again.");
            console.error("Error cancelling order:", error);
        }
    };

    return (
        <div className="h-full bg-[#0d0f1b] text-white flex flex-col">
            <div className="flex border-b border-white/10">
                {[
                    { key: "positions", label: "Positions" },
                    { key: "orders", label: "Orders" },
                    { key: "history", label: "History" },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key as "positions" | "orders" | "history")}
                        className={`px-4 py-2 text-xs font-semibold ${tab === t.key ? "text-cyan-300 border-b-2 border-cyan-400" : "text-gray-400"}`}
                    >
                        {t.label}
                    </button>
                ))}
                {loading && <span className="ml-auto px-4 py-2 text-xs text-gray-500">loading…</span>}
            </div>
            {errorMessage && (
                <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                    {errorMessage}
                </div>
            )}

            <div className="flex-1 overflow-auto p-3 text-sm text-gray-300">
                {tab === "positions" && (
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-white/5 text-gray-400">
                                <tr>
                                    <th className="p-2 text-left">Symbol</th>
                                    <th className="p-2 text-left">Side</th>
                                    <th className="p-2 text-left">Volume</th>
                                    <th className="p-2 text-left">Entry</th>
                                    <th className="p-2 text-left">Current</th>
                                    <th className="p-2 text-left">P/L</th>
                                    <th className="p-2 text-left"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-gray-500">No open positions</td>
                                    </tr>
                                )}
                                {positions.map((pos) => {
                                    const live = prices[pos.symbol];
                                    const currentPrice = pos.side === "SELL"
                                        ? (live?.ask ?? pos.entryPrice)
                                        : (live?.bid ?? pos.entryPrice);
                                    const livePnl = live
                                        ? calcLivePnL(pos.symbol, pos.side, pos.entryPrice, pos.volume, currentPrice)
                                        : pos.pnl;
                                    const isProfit = livePnl >= 0;
                                    return (
                                        <tr key={pos.id} className="border-t border-white/10 hover:bg-white/5">
                                            <td className="p-2 font-semibold">{pos.symbol}</td>
                                            <td className={`p-2 font-semibold ${pos.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{pos.side}</td>
                                            <td className="p-2">{pos.volume}</td>
                                            <td className="p-2 font-mono">{pos.entryPrice?.toFixed(pos.entryPrice > 100 ? 2 : 5)}</td>
                                            <td className="p-2 font-mono">{currentPrice.toFixed(currentPrice > 100 ? 2 : 5)}</td>
                                            <td className={`p-2 font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                                                {isProfit ? "+" : ""}{livePnl.toFixed(2)}
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => closePosition(pos.id, pos.symbol, pos.side)}
                                                    className="px-2 py-0.5 text-[11px] rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 transition"
                                                >
                                                    Close
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === "orders" && (
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-white/5 text-gray-400">
                                <tr>
                                    <th className="p-2 text-left">Symbol</th>
                                    <th className="p-2 text-left">Side</th>
                                    <th className="p-2 text-left">Type</th>
                                    <th className="p-2 text-left">Volume</th>
                                    <th className="p-2 text-left">Price</th>
                                    <th className="p-2 text-left">Status</th>
                                    <th className="p-2 text-left"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-gray-500">No pending orders</td>
                                    </tr>
                                )}
                                {orders.map((ord) => (
                                    <tr key={ord.id} className="border-t border-white/10 hover:bg-white/5">
                                        <td className="p-2 font-semibold">{ord.symbol}</td>
                                        <td className={`p-2 font-semibold ${ord.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{ord.side}</td>
                                        <td className="p-2">{ord.type}</td>
                                        <td className="p-2">{ord.volume}</td>
                                        <td className="p-2 font-mono">{ord.price}</td>
                                        <td className="p-2 text-yellow-400">{ord.status}</td>
                                        <td className="p-2">
                                            <button
                                                onClick={() => cancelOrder(ord.id)}
                                                className="px-2 py-0.5 text-[11px] rounded border border-gray-500/50 text-gray-400 hover:bg-gray-500/20 transition"
                                            >
                                                Cancel
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === "history" && (
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-white/5 text-gray-400">
                                <tr>
                                    <th className="p-2 text-left">Symbol</th>
                                    <th className="p-2 text-left">Side</th>
                                    <th className="p-2 text-left">Volume</th>
                                    <th className="p-2 text-left">Open</th>
                                    <th className="p-2 text-left">Close</th>
                                    <th className="p-2 text-left">P/L</th>
                                    <th className="p-2 text-left">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-gray-500">No trade history</td>
                                    </tr>
                                )}
                                {history.map((h) => (
                                    <tr key={h.id} className="border-t border-white/10 hover:bg-white/5">
                                        <td className="p-2 font-semibold">{h.symbol}</td>
                                        <td className={`p-2 font-semibold ${h.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{h.side}</td>
                                        <td className="p-2">{h.volume}</td>
                                        <td className="p-2 font-mono">{h.openPrice}</td>
                                        <td className="p-2 font-mono">{h.closePrice}</td>
                                        <td className={`p-2 font-semibold ${h.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {h.profit >= 0 ? "+" : ""}{h.profit?.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-gray-500">{new Date(h.closeTime).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
