import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { BalanceCard, type AccountSummary } from "@/components/dashboard/BalanceCard";
import { ActionGrid } from "@/components/dashboard/ActionGrid";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TransactionsList } from "@/components/dashboard/TransactionsList";
import { AssetCard } from "@/components/dashboard/AssetCard";
import { PromoCard } from "@/components/dashboard/PromoCard";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { PendingAlertsScroller } from "@/components/dashboard/PendingAlertsScroller";
import { OfferHero } from "@/components/dashboard/OfferHero";
import { Card, CardContent } from "@/components/ui/card";
import { apiUrl } from "@/lib/api";

type TickerSymbol = {
    id: string;
    label: string;
    pair: string;
    tone: string;
};

type TickerPriceMap = Record<string, number | null>;

const TICKER_SYMBOLS: TickerSymbol[] = [
    { id: "bitcoin", label: "Bitcoin", pair: "BTC / USD", tone: "text-amber-300" },
    { id: "ethereum", label: "Ethereum", pair: "ETH / USD", tone: "text-sky-300" },
    { id: "solana", label: "Solana", pair: "SOL / USD", tone: "text-violet-300" },
    { id: "binancecoin", label: "BNB", pair: "BNB / USD", tone: "text-yellow-300" },
    { id: "ripple", label: "XRP", pair: "XRP / USD", tone: "text-blue-300" },
    { id: "cardano", label: "Cardano", pair: "ADA / USD", tone: "text-cyan-300" },
    { id: "dogecoin", label: "Dogecoin", pair: "DOGE / USD", tone: "text-orange-300" },
    { id: "litecoin", label: "Litecoin", pair: "LTC / USD", tone: "text-slate-300" },
    { id: "polkadot", label: "Polkadot", pair: "DOT / USD", tone: "text-pink-300" },
    { id: "chainlink", label: "Chainlink", pair: "LINK / USD", tone: "text-indigo-300" },
    { id: "avalanche-2", label: "Avalanche", pair: "AVAX / USD", tone: "text-rose-300" },
    { id: "tron", label: "Tron", pair: "TRX / USD", tone: "text-emerald-300" },
];

/** Row shape from /api/user/accounts, which lists every account the trader holds. */
function normalizeAccountRow(row: any): AccountSummary {
    const balanceValue = Number(row?.balance ?? 0);
    return {
        id: String(row?.id ?? ""),
        accountNumber: row?.accountNumber || row?.account_number || "",
        accountTypeName: row?.accountTypeName || row?.account_type_name || "Standard",
        tradingMode: (row?.tradingMode || row?.trading_mode || "demo") as "real" | "demo",
        balance: Number.isFinite(balanceValue) ? balanceValue : 0,
        currency: String(row?.currency || "USD"),
        isActive: Boolean(row?.isActive ?? row?.is_active),
    };
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [tickerPrices, setTickerPrices] = useState<{ prices: TickerPriceMap; updatedAt: number | null }>({
        prices: Object.fromEntries(TICKER_SYMBOLS.map((symbol) => [symbol.id, null])) as TickerPriceMap,
        updatedAt: null,
    });
    const [pendingAlerts, setPendingAlerts] = useState<string[]>([]);
    const [userName, setUserName] = useState<string>("");

    useEffect(() => {
        let isDisposed = false;
        const token = localStorage.getItem("auth_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Every account, not one per mode — /api/user/balance?mode= returns a
        // single account, so a trader with four only ever saw two.
        const loadBalances = async () => {
            try {
                const response = await fetch(apiUrl("/api/user/accounts"), { headers });
                if (!response.ok) return;
                const payload = await response.json();
                const rows = Array.isArray(payload?.data) ? payload.data : [];
                if (!isDisposed) {
                    setAccounts(rows.map(normalizeAccountRow));
                }
            } catch {
                // keep the previous list if the API is briefly unavailable
            } finally {
                if (!isDisposed) setLoadingAccounts(false);
            }
        };

        const loadTicker = async () => {
            try {
                const response = await fetch(
                    apiUrl(
                        `/api/prices/crypto?ids=${encodeURIComponent(
                            TICKER_SYMBOLS.map((symbol) => symbol.id).join(",")
                        )}`
                    )
                );
                if (!response.ok) {
                    return;
                }
                const payload = await response.json();
                const data = payload?.prices || {};

                if (!isDisposed) {
                    const nextPrices = TICKER_SYMBOLS.reduce<TickerPriceMap>((acc, symbol) => {
                        const maybePrice = data?.[symbol.id]?.usd;
                        acc[symbol.id] = typeof maybePrice === "number" ? maybePrice : null;
                        return acc;
                    }, {} as TickerPriceMap);

                    setTickerPrices({
                        prices: nextPrices,
                        updatedAt: Date.now(),
                    });
                }
            } catch {
                if (!isDisposed) {
                    setTickerPrices((current) => current);
                }
            }
        };

        const loadPendingAlerts = async () => {
            try {
                const response = await fetch(apiUrl("/api/user/profile"), { headers });
                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                const user = payload?.user || {};
                const profile = payload?.profile || {};

                // Same request already in flight for the alerts — reuse it for
                // the greeting rather than fetching the profile twice.
                const name = String(
                    user.firstName || user.first_name || profile.firstName || profile.first_name || user.name || "",
                ).trim();
                if (!isDisposed && name) {
                    setUserName(name.split(" ")[0]);
                }

                const nextAlerts: string[] = [];

                const hasEmailVerified = typeof user.emailVerified === "boolean";
                const hasMobileVerified = typeof user.mobileVerified === "boolean" || typeof user.phoneVerified === "boolean";

                const emailPending = hasEmailVerified ? !user.emailVerified : !user.email;
                const mobilePending = hasMobileVerified ? !(user.mobileVerified ?? user.phoneVerified) : !user.phone;

                if (emailPending) {
                    nextAlerts.push("Email verification pending");
                }
                if (mobilePending) {
                    nextAlerts.push("Mobile verification pending");
                }
                if (profile.kycStatus && profile.kycStatus !== "verified") {
                    nextAlerts.push(`KYC status pending: ${String(profile.kycStatus).replace("_", " ")}`);
                }

                if (!isDisposed) {
                    setPendingAlerts(nextAlerts);
                }
            } catch {
                if (!isDisposed) {
                    setPendingAlerts([]);
                }
            }
        };

        void loadBalances();
        void loadTicker();
        void loadPendingAlerts();

        const balanceInterval = window.setInterval(() => {
            void loadBalances();
        }, 15000);

        const tickerInterval = window.setInterval(() => {
            void loadTicker();
        }, 60000);

        return () => {
            isDisposed = true;
            window.clearInterval(balanceInterval);
            window.clearInterval(tickerInterval);
        };
    }, []);

    const handleQuickAction = (actionKey: string) => {
        if (actionKey === "deposit") {
            navigate("/deposit");
            return;
        }
        if (actionKey === "withdraw") {
            navigate("/withdraw");
            return;
        }
        if (actionKey === "funding") {
            navigate("/wallet?tab=requests");
        }
    };

    return (
        <>
            <Header />
            <div className="w-full px-2 py-2 sm:px-3 lg:px-4">
                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12">
                        <MarketTicker symbols={TICKER_SYMBOLS} prices={tickerPrices.prices} updatedAt={tickerPrices.updatedAt} />
                    </div>

                    {/* Admin-managed promotional hero. Renders nothing when no
                        banners are active, so the grid closes up cleanly. */}
                    <div className="col-span-12">
                        <OfferHero />
                    </div>

                    {/* Greeting · accounts · quick actions */}
                    <div className="col-span-12 md:col-span-4 lg:col-span-3">
                        <Card className="h-full rounded-xl border-white/15 bg-white/5 backdrop-blur-md">
                            <CardContent className="flex h-full flex-col justify-center p-3">
                                <p className="text-lg font-bold leading-tight text-white sm:text-xl">
                                    Welcome back{userName ? `, ${userName}` : ""}!
                                </p>
                                <p className="mt-0.5 text-2xl leading-none">👋</p>
                                <p className="mt-1.5 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-sm font-semibold text-transparent">
                                    Trade. Earn. Level Up.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="col-span-12 md:col-span-8 lg:col-span-5">
                        <BalanceCard accounts={accounts} loading={loadingAccounts} />
                    </div>

                    <div className="col-span-12 lg:col-span-4">
                        <div className="space-y-2">
                            <ActionGrid onAction={handleQuickAction} />
                            <PendingAlertsScroller alerts={pendingAlerts} />
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-8">
                        <ChartCard />
                    </div>
                    <div className="col-span-12 lg:col-span-4">
                        <TransactionsList />
                    </div>

                    <div className="col-span-12 lg:col-span-8">
                        <AssetCard />
                    </div>
                    <div className="col-span-12 lg:col-span-4">
                        <PromoCard />
                    </div>
                </div>
            </div>
        </>
    );
}
