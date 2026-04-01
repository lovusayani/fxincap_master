import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTradingStore } from "@/state/trading-store";
import {
    Home,
    Briefcase,
    TrendingUp,
    Wallet,
    Award,
    Phone,
    User,
    Settings,
    MoreHorizontal,
    Sun,
    Bell,
    DollarSign,
    LogOut,
    Menu,
    ChevronDown,
    Moon,
} from "lucide-react";
import PlatformLogo from "./PlatformLogo";

type UiTheme = "dark" | "light";

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [showMenu, setShowMenu] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [theme, setTheme] = useState<UiTheme>(() => {
        const saved = localStorage.getItem("ui_theme");
        if (saved === "dark" || saved === "light") return saved;
        return "dark";
    });
    const { account, loadAccount } = useTradingStore();
    const balance = account?.balance ?? 0;
    const isDemoMode = (account?.tradingMode || "demo").toLowerCase() === "demo";
    const modeLabel = isDemoMode ? "DEMO" : "REAL";

    useEffect(() => {
        loadAccount();
        const timer = setInterval(loadAccount, 5000);
        return () => clearInterval(timer);
    }, [loadAccount]);

    useEffect(() => {
        const mode = getComputedStyle(document.documentElement).getPropertyValue("--platform-theme-mode").trim();
        if (mode && mode !== "default") {
            return;
        }
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("ui_theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        const mode = getComputedStyle(document.documentElement).getPropertyValue("--platform-theme-mode").trim();
        if (mode && mode !== "default") return;
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    const handleLogout = () => {
        localStorage.removeItem("auth_token");
        navigate("/login");
    };

    const navLinks = [
        { label: "Dashboard", path: "/", icon: Home },
        { label: "Portfolio", path: "/portfolio", icon: Briefcase },
        { label: "Markets", path: "/markets", icon: TrendingUp },
        { label: "Wallet", path: "/wallet", icon: Wallet },
        { label: "IB Program", path: "/ib", icon: Award },
        { label: "Support", path: "/support", icon: Phone },
        { label: "Settings", path: "/settings", icon: Settings },
    ];

    const desktopTopLinks = [
        { label: "Portfolio", path: "/portfolio" },
        { label: "Markets", path: "/markets" },
        { label: "Mam/PaM", path: "/mampamm" },
        { label: "Wallet", path: "/wallet" },
        { label: "IB", path: "/ib" },
    ];

    const moreMenuItems = [
        { label: "Strategy", path: "/strategy" },
        { label: "TradeMaster", path: "/trademaster" },
        { label: "MAM/PAMM", path: "/mampamm" },
    ];

    const profileMenuItems = [
        { label: "Me", path: "/profile" },
        { label: "History", path: "/history" },
        { label: "Positions", path: "/positions" },
    ];

    const rootTheme = (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null) || theme;
    const isDark = rootTheme !== "light";

    const iconBtnCls = `p-2 rounded-lg transition flex items-center justify-center ${isDark
        ? "text-white hover:bg-white/10"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`;

    return (
        <header
            className={`platform-menu-surface sticky top-0 z-50 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
            style={{
                backgroundColor: `var(--platform-header-bg, ${isDark ? "#111827" : "#ffffff"})`,
            }}
        >
            <div className="max-w-full px-4 py-2.5 flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-shrink-0 lg:min-w-[170px] lg:w-[170px]">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className={`rounded-md px-1 py-0.5 transition flex items-center ${isDark ? "text-white hover:bg-white/10" : "text-gray-900 hover:bg-gray-100"}`}
                    >
                        <PlatformLogo mode="header" isDark={isDark} />
                    </button>
                </div>

                <nav className="hidden lg:flex items-center justify-start gap-1 ml-2 flex-1 overflow-x-auto">
                    {desktopTopLinks.map((link) => {
                        const isActive =
                            location.pathname === link.path ||
                            (link.path !== "/" && location.pathname.startsWith(link.path));

                        return (
                            <button
                                key={link.path}
                                type="button"
                                onClick={() => navigate(link.path)}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition whitespace-nowrap ${isActive
                                    ? isDark
                                        ? "bg-white/15 text-white"
                                        : "bg-gray-200 text-gray-900"
                                    : isDark
                                        ? "text-gray-200 hover:bg-white/10 hover:text-white"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    }`}
                            >
                                {link.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-1 ml-auto">
                    <button
                        onClick={() => navigate("/wallet")}
                        title={`Balance: $${balance.toFixed(2)}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.03] ${isDark ? "text-white" : "text-gray-900"}`}
                        style={{
                            background: isDark
                                ? "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 100%)"
                                : "linear-gradient(135deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)",
                            boxShadow: isDark
                                ? "0 2px 14px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.30)"
                                : "0 2px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.70)",
                            border: isDark ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(0,0,0,0.12)",
                            backdropFilter: "blur(6px)",
                        }}
                    >
                        <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{balance.toFixed(2)}</span>
                    </button>

                    <button onClick={toggleTheme} title="Toggle theme" className={iconBtnCls}>
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    <button title="Notifications" className={`${iconBtnCls} relative`}>
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full pointer-events-none" />
                    </button>

                    <button
                        onClick={() => navigate("/settings")}
                        title={`Trading mode: ${modeLabel}`}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition ${isDemoMode
                            ? "border-yellow-400 text-yellow-300 hover:bg-yellow-400/10"
                            : "border-green-400 text-green-300 hover:bg-green-400/10"
                            }`}
                    >
                        {modeLabel}
                    </button>

                    <button onClick={handleLogout} title="Logout" className={iconBtnCls}>
                        <LogOut className="w-4 h-4" />
                    </button>

                    <button onClick={() => setShowMenu(true)} title="Menu" className={iconBtnCls}>
                        <Menu className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div
                className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${showMenu ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                onClick={() => setShowMenu(false)}
            />

            <aside
                className={`platform-menu-surface fixed top-0 left-0 z-50 h-full w-72 max-w-[88vw] border-r shadow-2xl flex flex-col transition-transform duration-300 ease-out ${showMenu ? "translate-x-0" : "-translate-x-full"
                    } border-white/20 bg-gray-900`}
            >
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Menu</p>
                        <h2 className="text-lg font-bold text-white">FxIncap</h2>
                    </div>
                    <button
                        onClick={() => setShowMenu(false)}
                        className="p-2 rounded-lg transition text-lg leading-none text-gray-300 hover:bg-white/10"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3">
                    <div className="space-y-0.5 mb-2">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                                <button
                                    key={link.path}
                                    onClick={() => {
                                        navigate(link.path);
                                        setShowMenu(false);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition text-white hover:bg-white/10"
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    {link.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mb-0.5">
                        <button
                            onClick={() => setShowMore(!showMore)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition text-white hover:bg-white/10"
                        >
                            <MoreHorizontal className="h-4 w-4 flex-shrink-0" />
                            <span className="flex-1 text-left">More</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
                        </button>
                        {showMore && (
                            <div className="ml-4 mt-0.5 border-l border-white/10 pl-3 space-y-0.5 pb-1">
                                {moreMenuItems.map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            navigate(item.path);
                                            setShowMenu(false);
                                            setShowMore(false);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition text-gray-300 hover:bg-white/10 hover:text-white"
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-0.5">
                        <button
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition text-white hover:bg-white/10"
                        >
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="flex-1 text-left">Profile</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${showProfile ? "rotate-180" : ""}`} />
                        </button>
                        {showProfile && (
                            <div className="ml-4 mt-0.5 border-l border-white/10 pl-3 space-y-0.5 pb-1">
                                {profileMenuItems.map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => {
                                            navigate(item.path);
                                            setShowMenu(false);
                                            setShowProfile(false);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition text-gray-300 hover:bg-white/10 hover:text-white"
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </header >
    );
}
