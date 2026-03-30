import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bitcoin, Coins, CircleDollarSign } from "lucide-react";

const txs = [
    { id: "1", coin: "Bitcoin", amount: "+0.0052 BTC", type: "credit" as const, Icon: Bitcoin },
    { id: "2", coin: "Ethereum", amount: "-0.320 ETH", type: "debit" as const, Icon: Coins },
    { id: "3", coin: "USDT", amount: "+1250.00 USDT", type: "credit" as const, Icon: CircleDollarSign },
    { id: "4", coin: "BNB", amount: "+3.2 BNB", type: "credit" as const, Icon: Coins },
];

export function TransactionsList() {
    return (
        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-3">
                    {txs.map(({ id, coin, amount, type, Icon }) => (
                        <div key={id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-200">
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-medium text-gray-200">{coin}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-300">{amount}</span>
                                <Badge variant={type === "credit" ? "success" : "warning"}>{type === "credit" ? "In" : "Out"}</Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
