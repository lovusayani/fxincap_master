import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import BottomTabs from "@/components/trading/BottomTabs";
import MarketList from "@/components/trading/MarketList";
import TradingViewWidget from "@/components/trading/TradingViewWidget";
import TradingLayout from "@/components/trading/layout/TradingLayout";
import { useMarketStream } from "@/hooks/useMarketStream";
import { useToast } from "@/hooks/use-toast";
import { calculateLotFromAllocatedMargin, calculateRequiredMargin } from "@/lib/trading";
import type {
  OrderBookRow,
  RecentTradeRow,
  TradingAccountBalance,
} from "@/components/trading/layout/types";

interface AccountBalance extends TradingAccountBalance {}

function useAccountBalance(refreshKey: number): AccountBalance | null {
  const [bal, setBal] = useState<AccountBalance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/user/balance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.balance) setBal(data.balance as AccountBalance);
        }
      } catch {}
    };

    fetchBalance();
    timerRef.current = setInterval(fetchBalance, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshKey]);

  return bal;
}

const ALL_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD",
  "XAGUSD",
  "BTCUSDT",
  "ETHUSDT",
];

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildOrderBook(baseBid: number, baseAsk: number, seed: number): { asks: OrderBookRow[]; bids: OrderBookRow[] } {
  const bid = baseBid > 0 ? baseBid : 1.09876;
  const ask = baseAsk > 0 ? baseAsk : bid + (bid > 100 ? 0.35 : 0.00012);
  const step = bid > 100 ? 0.15 : 0.00005;

  const asks = Array.from({ length: 8 }, (_value, index) => {
    const price = ask + step * index;
    const amount = 0.35 + index * 0.11 + ((seed + index) % 5) * 0.02;
    return {
      price,
      amount,
      total: amount * (index + 1),
      side: "ask" as const,
    };
  }).reverse();

  const bids = Array.from({ length: 8 }, (_value, index) => {
    const price = bid - step * index;
    const amount = 0.33 + index * 0.1 + ((seed + index + 2) % 5) * 0.02;
    return {
      price,
      amount,
      total: amount * (index + 1),
      side: "bid" as const,
    };
  });

  return { asks, bids };
}

export default function Markets() {
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showTabletLeft, setShowTabletLeft] = useState(false);
  const [showTabletRight, setShowTabletRight] = useState(false);
  const [showTabletBottom, setShowTabletBottom] = useState(false);
  const [showMobileTradingPanel, setShowMobileTradingPanel] = useState(false);
  const [showMobileMarketList, setShowMobileMarketList] = useState(false);
  const [lot, setLot] = useState(0.01);
  const [leverage, setLeverage] = useState(100);
  const [orderType, setOrderType] = useState<"Market" | "Limit" | "Stop HFT">("Market");
  const [pendingPrice, setPendingPrice] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [allocationPercent, setAllocationPercent] = useState(25);
  const [chartInterval, setChartInterval] = useState("1H");
  const [chartDensity, setChartDensity] = useState<"normal" | "expanded">("expanded");
  const [recentTrades, setRecentTrades] = useState<RecentTradeRow[]>([]);
  const lastTickRef = useRef<number>(0);

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

  const tradingViewInterval = useMemo(() => {
    const intervalMap: Record<string, string> = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "1H": "60",
      "4H": "240",
      "1D": "1D",
    };

    return intervalMap[chartInterval] ?? "60";
  }, [chartInterval]);

  const orderBook = useMemo(
    () => buildOrderBook(currentSymbol.bid, currentSymbol.ask, Number(liveTick?.timestamp ?? Date.now())),
    [currentSymbol.ask, currentSymbol.bid, liveTick?.timestamp]
  );

  useEffect(() => {
    if (!liveTick?.timestamp || liveTick.timestamp === lastTickRef.current) return;
    lastTickRef.current = liveTick.timestamp;

    const tradePrice = Number(((liveTick.bid + liveTick.ask) / 2).toFixed(liveTick.bid > 100 ? 2 : 5));
    const tradeAmount = Number((0.1 + ((liveTick.timestamp % 7) + 1) * 0.07).toFixed(3));
    const tradeSide: RecentTradeRow["side"] = liveTick.change.startsWith("-") ? "sell" : "buy";
    const timeLabel = new Date(liveTick.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setRecentTrades((prev) => [
      {
        id: `${selectedSymbol}-${liveTick.timestamp}`,
        price: tradePrice,
        amount: tradeAmount,
        timeLabel,
        side: tradeSide,
      },
      ...prev,
    ].slice(0, 18));
  }, [liveTick, selectedSymbol]);

  useEffect(() => {
    setRecentTrades([]);
    lastTickRef.current = 0;
  }, [selectedSymbol]);

  useEffect(() => {
    const freeMargin = Number(accountBal?.freeMargin ?? 0);
    const marketPrice = currentSymbol.ask || currentSymbol.bid || 0;
    const pending = parseFloat(pendingPrice) || 0;
    const effectivePrice = orderType === "Market" ? marketPrice : pending;
    if (freeMargin <= 0 || effectivePrice <= 0 || leverage <= 0) return;

    const allocationValue = (freeMargin * allocationPercent) / 100;
    const computedLot = calculateLotFromAllocatedMargin(selectedSymbol, allocationValue, effectivePrice, leverage);
    setLot(computedLot);
  }, [accountBal?.freeMargin, allocationPercent, currentSymbol.ask, currentSymbol.bid, leverage, orderType, pendingPrice, selectedSymbol]);

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

    if (requiredMargin > availableFreeMargin) {
      toast({
        title: "Insufficient margin",
        description: `Required margin is $${requiredMargin.toFixed(2)} but only $${availableFreeMargin.toFixed(2)} free margin is available.`,
      });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(isPendingOrder ? "/api/orders" : "/api/trades/open", {
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
        console.log("Trading action success:", {
          symbol: selectedSymbol,
          side,
          orderType,
          lot,
          price: orderPrice,
        });

        setSl("");
        setTp("");
        if (isPendingOrder) setPendingPrice("");
        setRefreshKey((value) => value + 1);
      } else {
        toast({
          title: "✗ Order Failed",
          description: data.error || data.message || "Unknown error",
        });
      }
    } catch (error) {
      toast({
        title: "✗ Network Error",
        description: String(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <TradingLayout
        currentSymbol={currentSymbol}
        accountBalance={accountBal}
        symbolOptions={ALL_SYMBOLS}
        onSymbolChange={setSelectedSymbol}
        orderBook={orderBook}
        recentTrades={recentTrades}
        marketPanel={<MarketList active={selectedSymbol} onSelect={setSelectedSymbol} prices={prices} />}
        chartInterval={chartInterval}
        onChartIntervalChange={setChartInterval}
        chartDensity={chartDensity}
        onChartDensityChange={setChartDensity}
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={() => setShowLeftSidebar((value) => !value)}
        showRightSidebar={showRightSidebar}
        onToggleRightSidebar={() => setShowRightSidebar((value) => !value)}
        showTabletLeft={showTabletLeft}
        setShowTabletLeft={setShowTabletLeft}
        showTabletRight={showTabletRight}
        setShowTabletRight={setShowTabletRight}
        showTabletBottom={showTabletBottom}
        setShowTabletBottom={setShowTabletBottom}
        showMobileTradingPanel={showMobileTradingPanel}
        setShowMobileTradingPanel={setShowMobileTradingPanel}
        showMobileMarketList={showMobileMarketList}
        setShowMobileMarketList={setShowMobileMarketList}
        chart={<TradingViewWidget symbol={selectedSymbol} theme="dark" interval={tradingViewInterval} />}
        bottomTabs={<BottomTabs prices={prices} refreshKey={refreshKey} onTradeClosed={() => setRefreshKey((value) => value + 1)} />}
        orderType={orderType}
        setOrderType={setOrderType}
        pendingPrice={pendingPrice}
        setPendingPrice={setPendingPrice}
        lot={lot}
        setLot={setLot}
        leverage={leverage}
        setLeverage={setLeverage}
        allocationPercent={allocationPercent}
        setAllocationPercent={setAllocationPercent}
        freeMargin={accountBal?.freeMargin ?? 0}
        sl={sl}
        setSl={setSl}
        tp={tp}
        setTp={setTp}
        onBuy={() => placeOrder("BUY")}
        onSell={() => placeOrder("SELL")}
        submitting={submitting}
      />
    </>
  );
}
