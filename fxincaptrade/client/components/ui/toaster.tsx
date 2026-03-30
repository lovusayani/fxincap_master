import React from "react";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
    const { toasts, dismiss } = useToast();

    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 w-[320px] max-w-[90vw]">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className="rounded-lg border border-gray-700 bg-gray-900/95 text-white shadow-xl backdrop-blur px-4 py-3"
                >
                    {t.title && <div className="font-semibold text-sm">{t.title}</div>}
                    {t.description && (
                        <div className="text-xs text-gray-300 mt-1">{t.description}</div>
                    )}
                    <button
                        className="text-[11px] text-gray-400 hover:text-white mt-2"
                        onClick={() => dismiss(t.id)}
                    >
                        Dismiss
                    </button>
                </div>
            ))}
        </div>
    );
}
