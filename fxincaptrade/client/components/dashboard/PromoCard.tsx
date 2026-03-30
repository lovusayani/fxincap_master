import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PromoCard() {
    return (
        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-2xl" />
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">Boost Your Earnings</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <p className="text-sm text-gray-300">
                    Unlock VIP fee tiers and priority market insights by activating your advanced plan.
                </p>
                <Button className="mt-4 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:opacity-90">
                    Explore Promotion
                </Button>
            </CardContent>
        </Card>
    );
}
