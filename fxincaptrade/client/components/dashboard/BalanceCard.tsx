import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BalanceSummary = {
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    currency: string;
    accountNumber?: string;
    isAvailable: boolean;
};

interface BalanceCardProps {
    realBalance: BalanceSummary;
    demoBalance: BalanceSummary;
}

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function BalancePanel({
    label,
    balance,
    tone,
}: {
    label: string;
    balance: BalanceSummary;
    tone: string;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">{label}</p>
                    <p className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${tone}`}>
                        {balance.isAvailable ? formatCurrency(balance.balance, balance.currency) : "Unavailable"}
                    </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
                    {balance.accountNumber || "No account"}
                </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Balance</p>
                    <p className="mt-2 font-semibold text-white">
                        {balance.isAvailable ? formatCurrency(balance.balance, balance.currency) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Equity</p>
                    <p className="mt-2 font-semibold text-white">
                        {balance.isAvailable ? formatCurrency(balance.equity, balance.currency) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Margin</p>
                    <p className="mt-2 font-semibold text-white">
                        {balance.isAvailable ? formatCurrency(balance.margin, balance.currency) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Free Margin</p>
                    <p className="mt-2 font-semibold text-white">
                        {balance.isAvailable ? formatCurrency(balance.freeMargin, balance.currency) : "--"}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function BalanceCard({ realBalance, demoBalance }: BalanceCardProps) {
    return (
        <Card className="relative overflow-hidden rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-2xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-blue-500/20" />
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">Account Balances</CardTitle>
            </CardHeader>
            <CardContent className="relative p-4 pt-1">
                <div className="grid gap-4 lg:grid-cols-2">
                    <BalancePanel label="Real" balance={realBalance} tone="text-emerald-300" />
                    <BalancePanel label="TDemo" balance={demoBalance} tone="text-sky-300" />
                </div>
            </CardContent>
        </Card>
    );
}
