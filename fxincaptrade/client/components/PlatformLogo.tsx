import React, { useEffect, useState } from "react";

interface Props {
    mode: "header" | "auth";
    /** If not provided, derived from current data-theme attribute */
    isDark?: boolean;
    className?: string;
}

function readLogos() {
    return {
        dark: localStorage.getItem("platform_logo_dark") || "",
        light: localStorage.getItem("platform_logo_light") || "",
        square: localStorage.getItem("platform_logo_square") || "",
    };
}

export default function PlatformLogo({ mode, isDark, className }: Props) {
    const [logos, setLogos] = useState(readLogos);
    const [isCompactHeader, setIsCompactHeader] = useState(
        () => typeof window !== "undefined" && window.innerWidth < 640
    );

    useEffect(() => {
        const handler = () => setLogos(readLogos());
        window.addEventListener("platform-logos-updated", handler);
        return () => window.removeEventListener("platform-logos-updated", handler);
    }, []);

    useEffect(() => {
        if (mode !== "header") return;
        const onResize = () => setIsCompactHeader(window.innerWidth < 640);
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [mode]);

    const dark = isDark ?? (document.documentElement.getAttribute("data-theme") !== "light");
    const wideSrc = dark ? logos.dark : logos.light;
    const src = mode === "header" && isCompactHeader && logos.square ? logos.square : wideSrc;
    const fallback = "SPRS TRADE";

    if (mode === "header") {
        return src ? (
            <img
                src={src}
                alt="Platform Logo"
                className={`h-7 object-contain max-w-[150px] ${className ?? ""}`}
            />
        ) : (
            <span className={`text-xl font-bold ${className ?? ""}`}>{fallback}</span>
        );
    }

    // auth mode — centered, larger
    return (
        <div className={`flex justify-center mb-2 ${className ?? ""}`}>
            {src ? (
                <img src={src} alt="Platform Logo" className="h-10 object-contain max-w-[220px]" />
            ) : (
                <span className="text-2xl font-bold">{fallback}</span>
            )}
        </div>
    );
}
