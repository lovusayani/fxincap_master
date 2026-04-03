import React, { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import type { PriceTick } from "@/hooks/useMarketStream";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateStopLossForSide, validateTakeProfitForSide } from "@/lib/trading";

interface Position {
    id: string;
    symbol: string;
    side: string;
    volume: number;
    entryPrice: number;
    pnl: number;
    status: string;
    stopLoss: number | null;
    takeProfit: number | null;
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

function formatOrderPrice(price: number): string {
    if (!Number.isFinite(price)) return "—";
    return price > 100 ? price.toFixed(2) : price.toFixed(5);
}

type SlTpEditModal =
    | null
    | {
          kind: "sl" | "tp";
          tradeId: string;
          symbol: string;
          side: "BUY" | "SELL";
          entryPrice: number;
          draft: string;
      };

export default function BottomTabs({ prices = {}, refreshKey = 0, onTradeClosed }: BottomTabsProps) {
    const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
    const [positions, setPositions] = useState<Position[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [slTpModal, setSlTpModal] = useState<SlTpEditModal>(null);
    const [slTpModalError, setSlTpModalError] = useState<string | null>(null);
    const [slTpSaving, setSlTpSaving] = useState(false);

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
                fetch(apiUrl("/api/trades/open"), { headers: authHeaders() }),
                fetch(apiUrl("/api/orders"), { headers: authHeaders() }),
                fetch(apiUrl("/api/history?limit=10"), { headers: authHeaders() }),
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
                    stopLoss:
                        t.stop_loss != null && t.stop_loss !== ""
                            ? parseFloat(t.stop_loss)
                            : null,
                    takeProfit:
                        t.take_profit != null && t.take_profit !== ""
                            ? parseFloat(t.take_profit)
                            : null,
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

    /** Keep positions/history in sync when the server closes trades (SL/TP hits). */
    useEffect(() => {
        const id = setInterval(() => {
            if (localStorage.getItem("auth_token")) fetchAll();
        }, 6000);
        return () => clearInterval(id);
    }, [fetchAll]);

    const closePosition = async (positionId: string, symbol: string, side: string) => {
        try {
            const live = prices[symbol];
            const closePrice = side === "SELL" ? (live?.ask ?? 0) : (live?.bid ?? 0);
            if (closePrice <= 0) {
                setErrorMessage(`No live ${side === "SELL" ? "ask" : "bid"} quote is available for ${symbol}.`);
                return;
            }
            const res = await fetch(apiUrl(`/api/trades/${positionId}/close`), {
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

    const saveSlTp = async () => {
        if (!slTpModal) return;
        setSlTpModalError(null);
        const raw = slTpModal.draft.trim().replace(",", ".");
        const parsed = raw === "" ? null : parseFloat(raw);
        if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
            setSlTpModalError("Enter a valid price or leave empty to clear.");
            return;
        }
        const side = slTpModal.side;
        const entry = slTpModal.entryPrice;
        if (slTpModal.kind === "sl") {
            const v = validateStopLossForSide(side, entry, parsed);
            if (!v.ok) {
                setSlTpModalError(v.message);
                return;
            }
        } else {
            const v = validateTakeProfitForSide(side, entry, parsed);
            if (!v.ok) {
                setSlTpModalError(v.message);
                return;
            }
        }
        const body =
            slTpModal.kind === "sl"
                ? { stopLoss: parsed }
                : { takeProfit: parsed };
        setSlTpSaving(true);
        try {
            const res = await fetch(apiUrl(`/api/trades/${slTpModal.tradeId}/modify`), {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success !== false) {
                setSlTpModal(null);
                setErrorMessage(null);
                fetchAll();
            } else {
                setSlTpModalError(data.error || data.message || "Update failed");
            }
        } catch {
            setSlTpModalError("Network error");
        } finally {
            setSlTpSaving(false);
        }
    };

    const cancelOrder = async (orderId: string) => {
        try {
            const res = await fetch(apiUrl(`/api/orders/${orderId}`), {
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
                    <div className="rounded-lg border border-white/10 overflow-x-auto">
                        <table className="w-full min-w-[720px] text-xs">
                            <thead className="bg-white/5 text-gray-400">
                                <tr>
                                    <th className="p-2 text-left">Symbol</th>
                                    <th className="p-2 text-left">Side</th>
                                    <th className="p-2 text-left">Volume</th>
                                    <th className="p-2 text-left">Entry</th>
                                    <th className="p-2 text-left">SL</th>
                                    <th className="p-2 text-left">TP</th>
                                    <th className="p-2 text-left">Current</th>
                                    <th className="p-2 text-left">P/L</th>
                                    <th className="p-2 text-left"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-4 text-center text-gray-500">No open positions</td>
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
                                    const sideU = pos.side === "BUY" || pos.side === "SELL" ? pos.side : "BUY";
                                    return (
                                        <tr key={pos.id} className="border-t border-white/10 hover:bg-white/5">
                                            <td className="p-2 font-semibold">{pos.symbol}</td>
                                            <td className={`p-2 font-semibold ${pos.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{pos.side}</td>
                                            <td className="p-2">{pos.volume}</td>
                                            <td className="p-2 font-mono">{pos.entryPrice?.toFixed(pos.entryPrice > 100 ? 2 : 5)}</td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-[11px]">
                                                        {pos.stopLoss != null && Number.isFinite(pos.stopLoss) ? formatOrderPrice(pos.stopLoss) : "—"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        title="Edit stop loss"
                                                        onClick={() => {
                                                            setSlTpModalError(null);
                                                            setSlTpModal({
                                                                kind: "sl",
                                                                tradeId: pos.id,
                                                                symbol: pos.symbol,
                                                                side: sideU,
                                                                entryPrice: pos.entryPrice,
                                                                draft:
                                                                    pos.stopLoss != null && Number.isFinite(pos.stopLoss)
                                                                        ? String(pos.stopLoss)
                                                                        : "",
                                                            });
                                                        }}
                                                        className="inline-flex shrink-0 rounded border border-cyan-500/40 p-0.5 text-cyan-300/90 hover:bg-cyan-500/15"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-[11px]">
                                                        {pos.takeProfit != null && Number.isFinite(pos.takeProfit) ? formatOrderPrice(pos.takeProfit) : "—"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        title="Edit take profit"
                                                        onClick={() => {
                                                            setSlTpModalError(null);
                                                            setSlTpModal({
                                                                kind: "tp",
                                                                tradeId: pos.id,
                                                                symbol: pos.symbol,
                                                                side: sideU,
                                                                entryPrice: pos.entryPrice,
                                                                draft:
                                                                    pos.takeProfit != null && Number.isFinite(pos.takeProfit)
                                                                        ? String(pos.takeProfit)
                                                                        : "",
                                                            });
                                                        }}
                                                        className="inline-flex shrink-0 rounded border border-cyan-500/40 p-0.5 text-cyan-300/90 hover:bg-cyan-500/15"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
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

            {slTpModal && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
                    role="presentation"
                    onClick={() => !slTpSaving && setSlTpModal(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sl-tp-edit-title"
                        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#12152a] p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="sl-tp-edit-title" className="text-sm font-semibold text-white">
                            {slTpModal.kind === "sl" ? "Edit stop loss" : "Edit take profit"}
                        </h2>
                        <p className="mt-1 text-[11px] text-gray-500">
                            {slTpModal.symbol} · {slTpModal.side} · Entry {formatOrderPrice(slTpModal.entryPrice)}
                        </p>
                        <label className="mt-3 block text-[11px] uppercase tracking-wide text-gray-500">
                            Price (empty = remove)
                        </label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            className="mt-1 border-white/10 bg-white/5 text-white"
                            value={slTpModal.draft}
                            onChange={(e) =>
                                setSlTpModal((m) => (m ? { ...m, draft: e.target.value } : m))
                            }
                            placeholder={slTpModal.kind === "sl" ? "Stop loss price" : "Take profit price"}
                            autoFocus
                        />
                        {slTpModalError && <p className="mt-2 text-xs text-red-400">{slTpModalError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-gray-400"
                                disabled={slTpSaving}
                                onClick={() => setSlTpModal(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                className="bg-cyan-600 text-white hover:bg-cyan-700"
                                disabled={slTpSaving}
                                onClick={() => void saveSlTp()}
                            >
                                {slTpSaving ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
