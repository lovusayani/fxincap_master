import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import TradingViewWidget from "@/components/trading/TradingViewWidget";
import MarketList from "@/components/trading/MarketList";
import BottomTabs from "@/components/trading/BottomTabs";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useMarketStream } from "@/hooks/useMarketStream";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { calculateRequiredMargin } from "@/lib/trading";

interface AccountBalance {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    currency: string;
}

function useAccountBalance(refreshKey: number): AccountBalance | null {
    const [bal, setBal] = useState<AccountBalance | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        if (!token) return;

        const fetch_ = async () => {
            try {
                const res = await fetch(apiUrl("/api/user/balance"), {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const d = await res.json();
                    if (d.success && d.balance) setBal(d.balance as AccountBalance);
                }
            } catch { }
        };

        fetch_();
        timerRef.current = setInterval(fetch_, 10000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [refreshKey]);

    return bal;
}

const ALL_SYMBOLS = [
    "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "XAGUSD", "BTCUSDT", "ETHUSDT",
];

function authHeaders(): HeadersInit {
    const token = localStorage.getItem("auth_token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export default function Terminal() {
    const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [showMobileOrderTicket, setShowMobileOrderTicket] = useState(false);
    const [showMobileMarketList, setShowMobileMarketList] = useState(false);
    const [showTabletLeft, setShowTabletLeft] = useState(false);
    const [showTabletRight, setShowTabletRight] = useState(false);
    const [showTabletBottom, setShowTabletBottom] = useState(false);

    const [lot, setLot] = useState(0.01);
    const [leverage, setLeverage] = useState(100);
    const [orderType, setOrderType] = useState<"Market" | "Limit" | "Stop HFT">("Market");
    const [pendingPrice, setPendingPrice] = useState("");
    const [sl, setSl] = useState("");
    const [tp, setTp] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const { toast } = useToast();
    const prices = useMarketStream(ALL_SYMBOLS);
    const accountBal = useAccountBalance(refreshKey);

    const liveTick = prices[selectedSymbol];
    const currentSymbol = {
        code: selectedSymbol,
        bid: liveTick?.bid ?? 0,
        ask: liveTick?.ask ?? 0,
        change: liveTick?.change ?? "—",
    };

    const formatPrice = (price: number) => price.toFixed(price > 100 ? 2 : 5);

    const placeOrder = async (side: "BUY" | "SELL") => {
        if (submitting) return;
        const isPendingOrder = orderType !== "Market";
        const marketPrice = side === "BUY" ? (liveTick?.ask ?? 0) : (liveTick?.bid ?? 0);
        const orderPrice = isPendingOrder ? parseFloat(pendingPrice) : marketPrice;

        if (!isPendingOrder && (!liveTick || marketPrice <= 0)) {
            toast({
                title: "Quote unavailable",
                description: `Live ${side === "BUY" ? "ask" : "bid"} price is not ready for ${selectedSymbol}.`,
            });
            return;
        }

        if (!Number.isFinite(orderPrice) || orderPrice <= 0) {
            toast({
                title: "Invalid price",
                description: isPendingOrder
                    ? `Enter a valid ${orderType === "Limit" ? "limit" : "trigger"} price before placing the order.`
                    : "A valid live price is required before placing the order.",
            });
            return;
        }

        const requiredMargin = calculateRequiredMargin(selectedSymbol, lot, orderPrice, leverage);
        const availableFreeMargin = Number(accountBal?.freeMargin ?? 0);

        if (availableFreeMargin <= 0) {
            toast({
                title: "No free margin",
                description:
                    "Your free margin is zero or negative. Close positions or cancel pending orders before placing new trades.",
            });
            return;
        }

        if (requiredMargin > availableFreeMargin) {
            toast({
                title: "Insufficient margin",
                description: `Required margin is $${requiredMargin.toFixed(2)} but only $${availableFreeMargin.toFixed(2)} free margin is available.`,
            });
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch(isPendingOrder ? apiUrl("/api/orders") : apiUrl("/api/trades/open"), {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    symbol: selectedSymbol,
                    side,
                    ...(isPendingOrder
                        ? {
                            type: orderType,
                            volume: lot,
                            price: orderPrice,
                            leverage,
                        }
                        : {
                            volume: lot,
                            entryPrice: orderPrice,
                            leverage,
                            stopLoss: sl ? parseFloat(sl) : undefined,
                            takeProfit: tp ? parseFloat(tp) : undefined,
                        }),
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (isPendingOrder) {
                    toast({
                        title: `✓ ${orderType} Order Placed`,
                        description: `${selectedSymbol} ${side} ${lot} lots @ ${formatPrice(orderPrice)} is pending. Check Orders tab below.`,
                    });
                } else {
                    toast({
                        title: `✓ ${side} Order Placed`,
                        description: `Trade ID: #${data.tradeId} · ${selectedSymbol} ${side} ${lot} lots @ ${formatPrice(orderPrice)} · Leverage ${leverage}x · Margin locked: $${requiredMargin.toFixed(2)}. Check Positions tab below.`,
                    });
                }

                setSl("");
                setTp("");
                if (isPendingOrder) setPendingPrice("");
                setRefreshKey((k) => k + 1);
            } else {
                toast({
                    title: "✗ Order Failed",
                    description: data.error || data.message || "Unknown error",
                });
            }
        } catch (err) {
            toast({
                title: "✗ Network Error",
                description: String(err),
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleBuyOrder = () => placeOrder("BUY");
    const handleSellOrder = () => placeOrder("SELL");

    return (
        <>
            <Header />

            <div className="hidden lg:flex h-screen flex-col">
                <div className="border-b border-gray-700 px-6 py-3 flex justify-between items-center bg-[#10131f]">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Terminal</h1>
                        <span className="text-gray-400">Live Trading Terminal</span>
                    </div>
                    {accountBal && (
                        <div className="flex items-center gap-5 text-xs">
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase tracking-wide">Balance</span>
                                <span className="font-semibold text-white">{accountBal.currency} {accountBal.balance.toFixed(2)}</span>
                            </div>
                            <div className="w-px h-8 bg-gray-700" />
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase tracking-wide">Equity</span>
                                <span className="font-semibold text-cyan-300">{accountBal.currency} {accountBal.equity.toFixed(2)}</span>
                            </div>
                            <div className="w-px h-8 bg-gray-700" />
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase tracking-wide">Margin</span>
                                <span className="font-semibold text-yellow-400">{accountBal.currency} {accountBal.margin.toFixed(2)}</span>
                            </div>
                            <div className="w-px h-8 bg-gray-700" />
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase tracking-wide">Free Margin</span>
                                <span className={`font-semibold ${accountBal.freeMargin > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {accountBal.currency} {accountBal.freeMargin.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {!showLeftSidebar ? (
                        <div className="w-12 border-r border-gray-700 flex items-center justify-center bg-[#0f111b]">
                            <button onClick={() => setShowLeftSidebar(true)} className="p-2 hover:bg-gray-800 rounded">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-80 border-r border-gray-700 flex flex-col overflow-y-auto bg-[#0f111b]">
                            <div className="border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 bg-[#0f111b]">
                                <h2 className="font-bold text-lg">Order Ticket</h2>
                                <button onClick={() => setShowLeftSidebar(false)} className="p-1 hover:bg-gray-800 rounded">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            </div>
                            <DesktopOrderTicket
                                currentSymbol={currentSymbol}
                                selectedSymbol={selectedSymbol}
                                lot={lot}
                                setLot={setLot}
                                leverage={leverage}
                                setLeverage={setLeverage}
                                orderType={orderType}
                                setOrderType={setOrderType}
                                pendingPrice={pendingPrice}
                                setPendingPrice={setPendingPrice}
                                sl={sl}
                                setSl={setSl}
                                tp={tp}
                                setTp={setTp}
                                handleBuyOrder={handleBuyOrder}
                                handleSellOrder={handleSellOrder}
                                submitting={submitting}
                                freeMargin={Number(accountBal?.freeMargin ?? 0)}
                            />
                        </div>
                    )}

                    <div className="flex-1 flex flex-col border-r border-gray-700 overflow-hidden bg-black">
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <TradingViewWidget symbol={selectedSymbol} theme="dark" />
                        </div>
                        <div className="border-t border-gray-700 flex-shrink-0" style={{ height: 220 }}>
                            <BottomTabs prices={prices} refreshKey={refreshKey} onTradeClosed={() => setRefreshKey((value) => value + 1)} />
                        </div>
                    </div>

                    {!showRightSidebar ? (
                        <div className="w-12 border-l border-gray-700 flex items-center justify-center bg-[#0f111b]">
                            <button onClick={() => setShowRightSidebar(true)} className="p-2 hover:bg-gray-800 rounded">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-80 border-l border-gray-700 flex flex-col bg-[#0f111b]">
                            <div className="border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 bg-[#0f111b]">
                                <h2 className="font-bold text-lg">Markets</h2>
                                <button onClick={() => setShowRightSidebar(false)} className="p-1 hover:bg-gray-800 rounded">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                            <MarketList active={selectedSymbol} onSelect={setSelectedSymbol} prices={prices} />
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden md:flex lg:hidden flex-col relative bg-black overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <TradingViewWidget symbol={selectedSymbol} theme="dark" />
                </div>

                <button
                    onClick={() => {
                        setShowTabletLeft(true);
                        setShowTabletRight(false);
                    }}
                    className="fixed left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-20 rounded-r-2xl"
                    style={{
                        opacity: showTabletLeft ? 0 : 1,
                        pointerEvents: showTabletLeft ? "none" : "auto",
                        transition: "opacity 0.25s",
                        background: "linear-gradient(180deg,rgba(28,28,48,.93) 0%,rgba(10,10,26,.90) 100%)",
                        backdropFilter: "blur(18px) saturate(170%)",
                        WebkitBackdropFilter: "blur(18px) saturate(170%)",
                        border: "1px solid rgba(255,255,255,.14)",
                        borderLeft: "none",
                        boxShadow: "4px 0 28px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.3)",
                    }}
                    title="Open Order Ticket"
                >
                    <ChevronRight className="w-4 h-4 text-white" />
                </button>

                <div
                    onClick={() => setShowTabletLeft(false)}
                    className="fixed inset-0 z-[30]"
                    style={{
                        background: "rgba(0,0,0,0.42)",
                        backdropFilter: "blur(3px)",
                        WebkitBackdropFilter: "blur(3px)",
                        opacity: showTabletLeft ? 1 : 0,
                        pointerEvents: showTabletLeft ? "auto" : "none",
                        transition: "opacity 0.28s",
                    }}
                />

                <div
                    className="fixed top-0 left-0 z-[40] flex flex-col"
                    style={{
                        width: 316,
                        maxWidth: "82vw",
                        height: "100vh",
                        transform: showTabletLeft ? "translateX(0)" : "translateX(-100%)",
                        transition: "transform 0.32s cubic-bezier(0.32,0,0.15,1)",
                        background: "linear-gradient(160deg,rgba(22,22,42,.97) 0%,rgba(8,8,22,.95) 100%)",
                        backdropFilter: "blur(30px) saturate(200%)",
                        WebkitBackdropFilter: "blur(30px) saturate(200%)",
                        borderRight: "1px solid rgba(255,255,255,.10)",
                        boxShadow: "14px 0 52px rgba(0,0,0,.65),inset 1px 0 0 rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.16)",
                    }}
                >
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
                        <h2 className="font-bold text-white text-sm tracking-wide">Order Ticket</h2>
                        <button onClick={() => setShowTabletLeft(false)} className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 transition">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto text-white">
                        <DesktopOrderTicket
                            currentSymbol={currentSymbol}
                            selectedSymbol={selectedSymbol}
                            lot={lot}
                            setLot={setLot}
                            leverage={leverage}
                            setLeverage={setLeverage}
                            orderType={orderType}
                            setOrderType={setOrderType}
                            pendingPrice={pendingPrice}
                            setPendingPrice={setPendingPrice}
                            sl={sl}
                            setSl={setSl}
                            tp={tp}
                            setTp={setTp}
                            handleBuyOrder={handleBuyOrder}
                            handleSellOrder={handleSellOrder}
                            submitting={submitting}
                            freeMargin={Number(accountBal?.freeMargin ?? 0)}
                        />
                    </div>
                </div>

                <button
                    onClick={() => {
                        setShowTabletRight(true);
                        setShowTabletLeft(false);
                    }}
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-20 rounded-l-2xl"
                    style={{
                        opacity: showTabletRight ? 0 : 1,
                        pointerEvents: showTabletRight ? "none" : "auto",
                        transition: "opacity 0.25s",
                        background: "linear-gradient(180deg,rgba(28,28,48,.93) 0%,rgba(10,10,26,.90) 100%)",
                        backdropFilter: "blur(18px) saturate(170%)",
                        WebkitBackdropFilter: "blur(18px) saturate(170%)",
                        border: "1px solid rgba(255,255,255,.14)",
                        borderRight: "none",
                        boxShadow: "-4px 0 28px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.3)",
                    }}
                    title="Open Markets"
                >
                    <ChevronLeft className="w-4 h-4 text-white" />
                </button>

                <div
                    onClick={() => setShowTabletRight(false)}
                    className="fixed inset-0 z-[30]"
                    style={{
                        background: "rgba(0,0,0,0.42)",
                        backdropFilter: "blur(3px)",
                        WebkitBackdropFilter: "blur(3px)",
                        opacity: showTabletRight ? 1 : 0,
                        pointerEvents: showTabletRight ? "auto" : "none",
                        transition: "opacity 0.28s",
                    }}
                />

                <div
                    className="fixed top-0 right-0 z-[40] flex flex-col"
                    style={{
                        width: 316,
                        maxWidth: "82vw",
                        height: "100vh",
                        transform: showTabletRight ? "translateX(0)" : "translateX(100%)",
                        transition: "transform 0.32s cubic-bezier(0.32,0,0.15,1)",
                        background: "linear-gradient(160deg,rgba(22,22,42,.97) 0%,rgba(8,8,22,.95) 100%)",
                        backdropFilter: "blur(30px) saturate(200%)",
                        WebkitBackdropFilter: "blur(30px) saturate(200%)",
                        borderLeft: "1px solid rgba(255,255,255,.10)",
                        boxShadow: "-14px 0 52px rgba(0,0,0,.65),inset -1px 0 0 rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.16)",
                    }}
                >
                    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
                        <h2 className="font-bold text-white text-sm tracking-wide">Markets</h2>
                        <button onClick={() => setShowTabletRight(false)} className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 transition">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <MarketList active={selectedSymbol} onSelect={setSelectedSymbol} prices={prices} />
                    </div>
                </div>

                <div
                    className="fixed bottom-0 left-0 right-0 z-[35] flex flex-col overflow-hidden"
                    style={{
                        height: showTabletBottom ? "55vh" : "44px",
                        transition: "height 0.36s cubic-bezier(0.32,0,0.15,1)",
                        background: "linear-gradient(0deg,rgba(14,14,30,.98) 0%,rgba(20,20,40,.94) 100%)",
                        backdropFilter: "blur(30px) saturate(200%)",
                        WebkitBackdropFilter: "blur(30px) saturate(200%)",
                        borderTop: "1px solid rgba(255,255,255,.13)",
                        boxShadow: "0 -12px 52px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.4)",
                        borderRadius: "18px 18px 0 0",
                    }}
                >
                    <button onClick={() => setShowTabletBottom(!showTabletBottom)} className="flex-shrink-0 flex items-center justify-between px-5 text-white" style={{ height: 44 }}>
                        <div className="flex items-center gap-3">
                            <span className="block rounded-full" style={{ width: 32, height: 4, background: "rgba(255,255,255,0.28)" }} />
                            <span className="text-xs font-semibold text-gray-300 tracking-wide">Order History</span>
                        </div>
                        <div className="text-gray-400">{showTabletBottom ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</div>
                    </button>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <BottomTabs prices={prices} refreshKey={refreshKey} onTradeClosed={() => setRefreshKey((value) => value + 1)} />
                    </div>
                </div>
            </div>

            <div className="md:hidden flex flex-col h-screen">
                <div className="flex-1 flex flex-col bg-black overflow-hidden">
                    <TradingViewWidget symbol={selectedSymbol} theme="dark" />
                </div>

                <div className="border-t border-gray-700 bg-gray-900">
                    <div className="px-4 py-2 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                        <div>
                            <div className="font-bold text-sm">{selectedSymbol}</div>
                            <div className={`text-xs ${currentSymbol.change.startsWith("-") ? "text-red-500" : "text-green-500"}`}>
                                {currentSymbol.bid ? currentSymbol.bid.toFixed(currentSymbol.bid > 100 ? 2 : 5) : "—"} {currentSymbol.change}
                            </div>
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        <div className="border-b border-gray-700">
                            <button
                                onClick={() => setShowMobileOrderTicket(!showMobileOrderTicket)}
                                className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-800 transition"
                            >
                                <span className="font-semibold text-sm">Order Ticket</span>
                                {showMobileOrderTicket ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showMobileOrderTicket && (
                                <div className="px-4 py-3 space-y-3 border-t border-gray-700 bg-gray-950">
                                    <MobileOrderTicket
                                        orderType={orderType}
                                        setOrderType={setOrderType}
                                        pendingPrice={pendingPrice}
                                        setPendingPrice={setPendingPrice}
                                        lot={lot}
                                        setLot={setLot}
                                        leverage={leverage}
                                        setLeverage={setLeverage}
                                        sl={sl}
                                        setSl={setSl}
                                        tp={tp}
                                        setTp={setTp}
                                        handleBuyOrder={handleBuyOrder}
                                        handleSellOrder={handleSellOrder}
                                        submitting={submitting}
                                        freeMargin={Number(accountBal?.freeMargin ?? 0)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="border-b border-gray-700">
                            <button
                                onClick={() => setShowMobileMarketList(!showMobileMarketList)}
                                className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-800 transition"
                            >
                                <span className="font-semibold text-sm">Markets</span>
                                {showMobileMarketList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showMobileMarketList && (
                                <div className="border-t border-gray-700 bg-gray-950 max-h-56 overflow-y-auto">
                                    <MarketList
                                        active={selectedSymbol}
                                        prices={prices}
                                        onSelect={(symbol) => {
                                            setSelectedSymbol(symbol);
                                            setShowMobileMarketList(false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function DesktopOrderTicket({
    currentSymbol,
    selectedSymbol,
    lot,
    setLot,
    leverage,
    setLeverage,
    orderType,
    setOrderType,
    pendingPrice,
    setPendingPrice,
    sl,
    setSl,
    tp,
    setTp,
    handleBuyOrder,
    handleSellOrder,
    submitting,
    freeMargin = 0,
}: any) {
    const hasBid = currentSymbol.bid > 0;
    const noFreeMargin = freeMargin <= 0;
    return (
        <div className="p-4 space-y-4">
            <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                <div className="font-bold text-lg">{selectedSymbol}</div>
                <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold font-mono">
                        {hasBid ? currentSymbol.bid.toFixed(currentSymbol.bid > 100 ? 2 : 5) : "—"}
                    </span>
                    {hasBid && currentSymbol.ask > 0 && (
                        <span className="text-sm text-gray-400 font-mono">
                            Ask: {currentSymbol.ask.toFixed(currentSymbol.ask > 100 ? 2 : 5)}
                        </span>
                    )}
                </div>
                <div className={`text-sm ${currentSymbol.change.startsWith("-") ? "text-red-500" : "text-emerald-400"}`}>
                    {currentSymbol.change}
                </div>
            </div>

            <div className="flex gap-2">
                {["Market", "Limit", "Stop HFT"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setOrderType(type as any)}
                        className={`flex-1 py-2 rounded border text-sm font-semibold transition-all ${orderType === type ? "bg-gray-700 border-gray-500" : "border-gray-600 hover:border-gray-500"
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {orderType !== "Market" && (
                <div>
                    <label className="block text-sm text-gray-400 mb-1">
                        {orderType === "Limit" ? "Limit Price" : "Trigger Price"}
                    </label>
                    <input
                        type="number"
                        placeholder={hasBid ? currentSymbol.bid.toFixed(currentSymbol.bid > 100 ? 2 : 5) : "0.00000"}
                        value={pendingPrice}
                        onChange={(e) => setPendingPrice(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm text-gray-400 mb-1">Lot Size</label>
                <div className="flex items-center gap-2">
                    <button onClick={() => setLot(Math.max(0.01, lot - 0.01))} className="px-2 py-1 border border-gray-600 rounded hover:bg-gray-800">-</button>
                    <input
                        type="number"
                        value={lot.toFixed(2)}
                        onChange={(e) => setLot(Math.max(0.01, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-center"
                        step="0.01"
                    />
                    <button onClick={() => setLot(lot + 0.01)} className="px-2 py-1 border border-gray-600 rounded hover:bg-gray-800">+</button>
                </div>
            </div>

            <div>
                <label className="block text-sm text-gray-400 mb-1">Leverage: {leverage}x</label>
                <input type="range" min="10" max="100" value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value))} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">SL</label>
                    <input type="number" placeholder="0.00000" value={sl} onChange={(e) => setSl(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">TP</label>
                    <input type="number" placeholder="0.00000" value={tp} onChange={(e) => setTp(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                </div>
            </div>

            {noFreeMargin && (
                <p className="text-xs text-red-400 rounded border border-red-500/30 bg-red-500/10 px-2 py-2">
                    No free margin — close positions or cancel pending orders before opening new trades.
                </p>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-700">
                <Button
                    onClick={handleBuyOrder}
                    disabled={submitting || noFreeMargin}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded disabled:opacity-60"
                >
                    {submitting ? "..." : "BUY"}
                </Button>
                <Button
                    onClick={handleSellOrder}
                    disabled={submitting || noFreeMargin}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded disabled:opacity-60"
                >
                    {submitting ? "..." : "SELL"}
                </Button>
            </div>
        </div>
    );
}

function MobileOrderTicket({
    orderType,
    setOrderType,
    pendingPrice,
    setPendingPrice,
    lot,
    setLot,
    leverage,
    setLeverage,
    sl,
    setSl,
    tp,
    setTp,
    handleBuyOrder,
    handleSellOrder,
    submitting,
    freeMargin = 0,
}: any) {
    const noFreeMargin = freeMargin <= 0;
    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                {["Market", "Limit", "Stop HFT"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setOrderType(type as any)}
                        className={`flex-1 py-1 rounded border text-xs font-semibold transition-all ${orderType === type ? "bg-blue-600 border-blue-500" : "border-gray-600 hover:border-gray-500"
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {orderType !== "Market" && (
                <input
                    type="number"
                    placeholder={orderType === "Limit" ? "Limit Price" : "Trigger Price"}
                    value={pendingPrice}
                    onChange={(e) => setPendingPrice(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                />
            )}

            <div className="grid grid-cols-2 gap-2">
                <input
                    type="number"
                    value={lot.toFixed(2)}
                    onChange={(e) => setLot(Math.max(0.01, parseFloat(e.target.value) || 0))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs text-center"
                />
                <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value) || 10)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs text-center"
                />
            </div>

            <div className="grid grid-cols-2 gap-1">
                <input type="number" placeholder="SL" value={sl} onChange={(e) => setSl(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs" />
                <input type="number" placeholder="TP" value={tp} onChange={(e) => setTp(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs" />
            </div>

            {noFreeMargin && (
                <p className="text-[10px] text-red-400 px-1">No free margin — close positions or cancel orders first.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleBuyOrder} disabled={submitting || noFreeMargin} className="bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 disabled:opacity-60">{submitting ? "..." : "BUY"}</Button>
                <Button onClick={handleSellOrder} disabled={submitting || noFreeMargin} className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 disabled:opacity-60">{submitting ? "..." : "SELL"}</Button>
            </div>
        </div>
    );
}