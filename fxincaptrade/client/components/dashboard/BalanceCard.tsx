import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AccountSummary = {
    id: string;
    accountNumber: string;
    accountTypeName: string;
    tradingMode: "real" | "demo";
    balance: number;
    currency: string;
    isActive: boolean;
};

interface BalanceCardProps {
    accounts: AccountSummary[];
    loading?: boolean;
}

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Compact summary of every account the trader holds: a combined total, then one
 * line per account.
 *
 * Previously this card read /api/user/balance?mode=real|demo, which returns a
 * single balance per mode — so a trader with four accounts only ever saw two.
 * It now takes the full list from /api/user/accounts.
 */
export function BalanceCard({ accounts, loading = false }: BalanceCardProps) {
    const currency = accounts[0]?.currency || "USD";
    const total = accounts.reduce((sum, a) => sum + a.balance, 0);

    return (
        <Card className="relative h-full overflow-hidden rounded-xl border-white/15 bg-white/5 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-blue-500/20" />

            <CardHeader className="p-2.5 pb-1">
                <CardTitle className="text-xs font-medium text-gray-300">Account Balances</CardTitle>
            </CardHeader>

            <CardContent className="relative p-2.5 pt-0">
                {/* Total sits above the per-account lines. */}
                <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Total</span>
                    <span className="text-2xl font-bold leading-none tracking-tight text-emerald-300 tabular-nums">
                        {formatCurrency(total, currency)}
                    </span>
                </div>

                {loading ? (
                    <p className="py-3 text-xs text-gray-500">Loading accounts…</p>
                ) : accounts.length === 0 ? (
                    <p className="py-3 text-xs text-gray-500">No accounts yet.</p>
                ) : (
                    <ul className="mt-1.5 space-y-1">
                        {accounts.map((acct, index) => (
                            <li
                                key={acct.id}
                                className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-white/5"
                            >
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="text-xs font-medium text-gray-200">Acc {index + 1}</span>
                                    <span
                                        className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase ${
                                            acct.tradingMode === "real"
                                                ? "bg-emerald-500/15 text-emerald-300"
                                                : "bg-amber-500/15 text-amber-300"
                                        }`}
                                    >
                                        {acct.tradingMode}
                                    </span>
                                    {acct.isActive && (
                                        <span className="shrink-0 rounded bg-blue-500/15 px-1 py-px text-[9px] font-semibold uppercase text-blue-300">
                                            Active
                                        </span>
                                    )}
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-white tabular-nums">
                                    {formatCurrency(acct.balance, acct.currency)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
