import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, FileText, Send, History } from "lucide-react";

const actions = [
    { key: "deposit", label: "Deposit", Icon: ArrowDownToLine },
    { key: "withdraw", label: "Withdraw", Icon: ArrowUpFromLine },
    { key: "transfer", label: "Transfer", Icon: ArrowRightLeft },
    { key: "statement", label: "Spot Statement", Icon: FileText },
    { key: "send", label: "Send", Icon: Send },
    { key: "funding", label: "Funding History", Icon: History },
];

interface ActionGridProps {
    onAction?: (actionKey: string) => void;
}

export function ActionGrid({ onAction }: ActionGridProps) {
    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {actions.map(({ key, label, Icon }) => (
                <Button
                    key={key}
                    variant="outline"
                    className="h-20 rounded-2xl border-white/15 bg-white/5 text-gray-100 hover:bg-white/10"
                    onClick={() => onAction?.(key)}
                >
                    <span className="flex flex-col items-center gap-1 text-center">
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] leading-tight sm:text-xs">{label}</span>
                    </span>
                </Button>
            ))}
        </div>
    );
}
