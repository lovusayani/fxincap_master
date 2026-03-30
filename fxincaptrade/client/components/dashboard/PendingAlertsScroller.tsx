import React, { useEffect, useMemo, useState } from "react";

interface PendingAlertsScrollerProps {
    alerts: string[];
}

export function PendingAlertsScroller({ alerts }: PendingAlertsScrollerProps) {
    const [index, setIndex] = useState(0);

    const normalizedAlerts = useMemo(
        () => (alerts.length > 0 ? alerts : ["No pending alerts"]),
        [alerts]
    );

    useEffect(() => {
        setIndex(0);
    }, [normalizedAlerts.length]);

    useEffect(() => {
        if (normalizedAlerts.length <= 1) {
            return;
        }

        const interval = window.setInterval(() => {
            setIndex((current) => (current + 1) % normalizedAlerts.length);
        }, 3500);

        return () => window.clearInterval(interval);
    }, [normalizedAlerts]);

    const isDanger = alerts.length > 0;

    return (
        <div className="relative h-11 overflow-hidden rounded-lg border border-red-500/20 bg-red-950/25">
            <div
                className="absolute inset-0 transition-transform duration-500"
                style={{ transform: `translateY(-${index * 100}%)` }}
            >
                {normalizedAlerts.map((alert, i) => (
                    <div
                        key={`${alert}-${i}`}
                        className={`flex h-11 items-center px-2 text-xs sm:text-sm ${isDanger ? "text-red-100" : "text-emerald-200"}`}
                    >
                        {alert}
                    </div>
                ))}
            </div>
        </div>
    );
}