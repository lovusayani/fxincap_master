import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { ActionGrid } from "@/components/dashboard/ActionGrid";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TransactionsList } from "@/components/dashboard/TransactionsList";
import { AssetCard } from "@/components/dashboard/AssetCard";
import { PromoCard } from "@/components/dashboard/PromoCard";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { PendingAlertsScroller } from "@/components/dashboard/PendingAlertsScroller";

type AccountBalance = {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    currency: string;
    accountNumber?: string;
    isAvailable: boolean;
};

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

function createEmptyBalance(): AccountBalance {
    return {
        balance: 0,
        equity: 0,
        margin: 0,
        freeMargin: 0,
        currency: "USD",
        accountNumber: undefined,
        isAvailable: false,
    };
}

function normalizeAccount(payload: any): AccountBalance {
    const account = payload?.balance || payload?.data || payload?.account || payload || {};

    const balanceValue = Number(account.balance ?? 0);
    const equityValue = Number(account.equity ?? 0);
    const marginValue = Number(account.margin ?? account.lockedBalance ?? 0);
    const freeMarginValue = Number(account.freeMargin ?? account.availableBalance ?? 0);

    return {
        balance: Number.isFinite(balanceValue) ? balanceValue : 0,
        equity: Number.isFinite(equityValue) ? equityValue : 0,
        margin: Number.isFinite(marginValue) ? marginValue : 0,
        freeMargin: Number.isFinite(freeMarginValue) ? freeMarginValue : 0,
        currency: account.currency || "USD",
        accountNumber: account.accountNumber || account.account_number || undefined,
        isAvailable: Boolean(
            account.accountNumber ||
            account.account_number ||
            Number.isFinite(balanceValue) ||
            Number.isFinite(equityValue) ||
            Number.isFinite(freeMarginValue)
        ),
    };
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [balances, setBalances] = useState<{ real: AccountBalance; demo: AccountBalance }>({
        real: createEmptyBalance(),
        demo: createEmptyBalance(),
    });
    const [tickerPrices, setTickerPrices] = useState<{ prices: TickerPriceMap; updatedAt: number | null }>({
        prices: Object.fromEntries(TICKER_SYMBOLS.map((symbol) => [symbol.id, null])) as TickerPriceMap,
        updatedAt: null,
    });
    const [pendingAlerts, setPendingAlerts] = useState<string[]>([]);

    useEffect(() => {
        let isDisposed = false;
        const token = localStorage.getItem("auth_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const loadBalances = async () => {
            try {
                const [realResponse, demoResponse] = await Promise.all([
                    fetch("/api/user/balance?mode=real", { headers }),
                    fetch("/api/user/balance?mode=demo", { headers }),
                ]);

                const nextBalances = {
                    real: createEmptyBalance(),
                    demo: createEmptyBalance(),
                };

                if (realResponse.ok) {
                    nextBalances.real = normalizeAccount(await realResponse.json());
                }
                if (demoResponse.ok) {
                    nextBalances.demo = normalizeAccount(await demoResponse.json());
                }

                if (!isDisposed) {
                    setBalances(nextBalances);
                }
            } catch {
                if (!isDisposed) {
                    setBalances({
                        real: createEmptyBalance(),
                        demo: createEmptyBalance(),
                    });
                }
            }
        };

        const loadTicker = async () => {
            try {
                const response = await fetch(
                    `/api/prices/crypto?ids=${encodeURIComponent(
                        TICKER_SYMBOLS.map((symbol) => symbol.id).join(",")
                    )}`
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
                const response = await fetch("/api/user/profile", { headers });
                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                const user = payload?.user || {};
                const profile = payload?.profile || {};

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
            <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12">
                        <MarketTicker symbols={TICKER_SYMBOLS} prices={tickerPrices.prices} updatedAt={tickerPrices.updatedAt} />
                    </div>
                    <div className="col-span-12 md:col-span-6 lg:col-span-7">
                        <BalanceCard realBalance={balances.real} demoBalance={balances.demo} />
                    </div>
                    <div className="col-span-12 md:col-span-6 lg:col-span-5">
                        <div className="space-y-4">
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
