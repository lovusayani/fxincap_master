import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import TerminalPage from "@/pages/Terminal";
import Portfolio from "@/pages/Portfolio";
import WalletPage from "@/pages/Wallet";
import DepositPage from "@/pages/Deposit";
import WithdrawPage from "@/pages/Withdraw";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import SupportPage from "@/pages/Support";
import StrategyPage from "@/pages/Strategy";
import TradeMasterPage from "@/pages/TradeMaster";
import MampammPage from "@/pages/Mampamm";
import ProfilePage from "@/pages/Profile";
import HistoryPage from "@/pages/History";
import PositionsPage from "@/pages/Positions";
import SettingsPage from "@/pages/Settings";
import IbPage from "@/pages/IB";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error("🔴 Error Boundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorInfo:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            color: "#ff4444",
            background: "#000",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            minHeight: "100vh",
          }}
        >
          <h1>⚠️ Application Error</h1>
          {this.state.error?.message}
          <br />
          {this.state.error?.stack}
        </div>
      );
    }

    return this.props.children;
  }
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("auth_token");
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const verificationStep = searchParams.get("step");
  const verificationEmail = searchParams.get("email");
  const verificationCode = searchParams.get("code");

  if (!token && verificationStep === "verify" && verificationEmail) {
    const nextSearch = new URLSearchParams({ step: "verify", email: verificationEmail });
    if (verificationCode) {
      nextSearch.set("code", verificationCode);
    }
    return <Navigate to={`/register?${nextSearch.toString()}`} replace />;
  }

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    let mounted = true;

    const shadcnThemeVars: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {
      default: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.205 0 0)",
          "--primary-foreground": "oklch(0.985 0 0)",
          "--secondary": "oklch(0.97 0 0)",
          "--secondary-foreground": "oklch(0.205 0 0)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.205 0 0)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.922 0 0)",
          "--primary-foreground": "oklch(0.205 0 0)",
          "--secondary": "oklch(0.269 0 0)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.488 0.243 264.376)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
      neutral: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.205 0 0)",
          "--primary-foreground": "oklch(0.985 0 0)",
          "--secondary": "oklch(0.97 0 0)",
          "--secondary-foreground": "oklch(0.205 0 0)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.205 0 0)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.922 0 0)",
          "--primary-foreground": "oklch(0.205 0 0)",
          "--secondary": "oklch(0.269 0 0)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.488 0.243 264.376)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
      amber: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.555 0.163 48.998)",
          "--primary-foreground": "oklch(0.987 0.022 95.277)",
          "--secondary": "oklch(0.967 0.001 286.375)",
          "--secondary-foreground": "oklch(0.21 0.006 285.885)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.666 0.179 58.318)",
          "--sidebar-primary-foreground": "oklch(0.987 0.022 95.277)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.473 0.137 46.201)",
          "--primary-foreground": "oklch(0.987 0.022 95.277)",
          "--secondary": "oklch(0.274 0.006 286.033)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.769 0.188 70.08)",
          "--sidebar-primary-foreground": "oklch(0.279 0.077 45.635)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
      blue: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.488 0.243 264.376)",
          "--primary-foreground": "oklch(0.97 0.014 254.604)",
          "--secondary": "oklch(0.967 0.001 286.375)",
          "--secondary-foreground": "oklch(0.21 0.006 285.885)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.546 0.245 262.881)",
          "--sidebar-primary-foreground": "oklch(0.97 0.014 254.604)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.424 0.199 265.638)",
          "--primary-foreground": "oklch(0.97 0.014 254.604)",
          "--secondary": "oklch(0.274 0.006 286.033)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.623 0.214 259.815)",
          "--sidebar-primary-foreground": "oklch(0.97 0.014 254.604)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
      cyan: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.57 0.155 215)",
          "--primary-foreground": "oklch(0.985 0 0)",
          "--secondary": "oklch(0.967 0.001 286.375)",
          "--secondary-foreground": "oklch(0.21 0.006 285.885)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.62 0.16 220)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.52 0.13 220)",
          "--primary-foreground": "oklch(0.985 0 0)",
          "--secondary": "oklch(0.274 0.006 286.033)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.58 0.15 225)",
          "--sidebar-primary-foreground": "oklch(0.985 0 0)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
      pink: {
        light: {
          "--radius": "0.625rem",
          "--background": "oklch(1 0 0)",
          "--foreground": "oklch(0.145 0 0)",
          "--card": "oklch(1 0 0)",
          "--card-foreground": "oklch(0.145 0 0)",
          "--popover": "oklch(1 0 0)",
          "--popover-foreground": "oklch(0.145 0 0)",
          "--primary": "oklch(0.525 0.223 3.958)",
          "--primary-foreground": "oklch(0.971 0.014 343.198)",
          "--secondary": "oklch(0.967 0.001 286.375)",
          "--secondary-foreground": "oklch(0.21 0.006 285.885)",
          "--muted": "oklch(0.97 0 0)",
          "--muted-foreground": "oklch(0.556 0 0)",
          "--accent": "oklch(0.97 0 0)",
          "--accent-foreground": "oklch(0.205 0 0)",
          "--destructive": "oklch(0.577 0.245 27.325)",
          "--border": "oklch(0.922 0 0)",
          "--input": "oklch(0.922 0 0)",
          "--ring": "oklch(0.708 0 0)",
          "--sidebar-background": "oklch(0.985 0 0)",
          "--sidebar-foreground": "oklch(0.145 0 0)",
          "--sidebar-primary": "oklch(0.592 0.249 0.584)",
          "--sidebar-primary-foreground": "oklch(0.971 0.014 343.198)",
          "--sidebar-accent": "oklch(0.97 0 0)",
          "--sidebar-accent-foreground": "oklch(0.205 0 0)",
          "--sidebar-border": "oklch(0.922 0 0)",
          "--sidebar-ring": "oklch(0.708 0 0)",
        },
        dark: {
          "--radius": "0.625rem",
          "--background": "oklch(0.145 0 0)",
          "--foreground": "oklch(0.985 0 0)",
          "--card": "oklch(0.205 0 0)",
          "--card-foreground": "oklch(0.985 0 0)",
          "--popover": "oklch(0.205 0 0)",
          "--popover-foreground": "oklch(0.985 0 0)",
          "--primary": "oklch(0.459 0.187 3.815)",
          "--primary-foreground": "oklch(0.971 0.014 343.198)",
          "--secondary": "oklch(0.274 0.006 286.033)",
          "--secondary-foreground": "oklch(0.985 0 0)",
          "--muted": "oklch(0.269 0 0)",
          "--muted-foreground": "oklch(0.708 0 0)",
          "--accent": "oklch(0.269 0 0)",
          "--accent-foreground": "oklch(0.985 0 0)",
          "--destructive": "oklch(0.704 0.191 22.216)",
          "--border": "oklch(1 0 0 / 10%)",
          "--input": "oklch(1 0 0 / 15%)",
          "--ring": "oklch(0.556 0 0)",
          "--sidebar-background": "oklch(0.205 0 0)",
          "--sidebar-foreground": "oklch(0.985 0 0)",
          "--sidebar-primary": "oklch(0.656 0.241 354.308)",
          "--sidebar-primary-foreground": "oklch(0.971 0.014 343.198)",
          "--sidebar-accent": "oklch(0.269 0 0)",
          "--sidebar-accent-foreground": "oklch(0.985 0 0)",
          "--sidebar-border": "oklch(1 0 0 / 10%)",
          "--sidebar-ring": "oklch(0.556 0 0)",
        },
      },
    };

    const applyShadcnTheme = (root: HTMLElement, presetRaw: string | undefined, resolvedTheme: "dark" | "light") => {
      const presetInput = String(presetRaw || "default").toLowerCase();
      const preset = presetInput === "nutral" ? "neutral" : presetInput;
      const bucket = shadcnThemeVars[preset] || shadcnThemeVars.default;
      const vars = resolvedTheme === "dark" ? bucket.dark : bucket.light;
      root.setAttribute("data-platform-shadcn-theme", preset);
      Object.entries(vars).forEach(([name, value]) => {
        root.style.setProperty(name, value);
      });
    };

    const applySettings = (data: any) => {
      if (!mounted || !data) return;
      const root = document.documentElement;

      const headerColorMap: Record<string, string> = {
        default: "",
        dark: "#111827",
        light: "#f8fafc",
        blue: "#1d4ed8",
        red: "#b91c1c",
        green: "#15803d",
        purple: "#7c3aed",
      };
      const fontSizeMap: Record<string, string> = {
        "8px": "8px",
        "14px": "14px",
        "16px": "16px",
      };

      const resolvedTheme = ["dark", "light"].includes(data.themeMode)
        ? data.themeMode
        : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

      const topbarKey = data.topbarBgColor || data.headerColor || "default";
      const resolvedTopbar =
        topbarKey === "default"
          ? resolvedTheme === "light"
            ? "#f8fafc"
            : "#111827"
          : (headerColorMap[topbarKey] || (resolvedTheme === "light" ? "#f8fafc" : "#111827"));

      const glossyOn = data.glossyEffect !== "off";
      const topbarTextColor =
        topbarKey === "light" || resolvedTopbar === "#f8fafc"
          ? "#0f172a"
          : "#f8fafc";

      root.classList.toggle("dark", resolvedTheme === "dark");
      root.setAttribute("data-theme", resolvedTheme);
      root.style.setProperty("--platform-theme-mode", String(data.themeMode || "default"));
      applyShadcnTheme(root, data.shadcnTheme, resolvedTheme as "dark" | "light");

      root.style.setProperty("--platform-header-bg", resolvedTopbar);
      root.style.setProperty("--platform-topbar-text-color", topbarTextColor);
      root.style.setProperty("--platform-font-size", fontSizeMap[data.platformFontSize] || "16px");
      root.style.setProperty(
        "--platform-card-gloss",
        glossyOn
          ? "linear-gradient(140deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 44%, rgba(255,255,255,0.10) 100%)"
          : "none"
      );

      localStorage.setItem("platform_logo_light", data.logoLightUrl || "");
      localStorage.setItem("platform_logo_dark", data.logoDarkUrl || "");
      localStorage.setItem("platform_logo_square", data.logoSquareUrl || "");
      window.dispatchEvent(new CustomEvent("platform-logos-updated"));
    };

    const fetchStyleSettings = async () => {
      try {
        const response = await fetch("/api/admin/style-settings", {
          method: "GET",
          credentials: "omit",
        });
        if (!response.ok) return;
        const json = await response.json();
        if (json?.success && json?.data) {
          applySettings(json.data);
        }
      } catch {
        // Keep defaults when style settings API is temporarily unavailable.
      }
    };

    fetchStyleSettings();
    const interval = setInterval(fetchStyleSettings, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/markets" element={<RequireAuth><Markets /></RequireAuth>} />
          <Route path="/terminal" element={<RequireAuth><TerminalPage /></RequireAuth>} />
          <Route path="/portfolio" element={<RequireAuth><Portfolio /></RequireAuth>} />
          <Route path="/wallet" element={<RequireAuth><WalletPage /></RequireAuth>} />
          <Route path="/deposit" element={<RequireAuth><DepositPage /></RequireAuth>} />
          <Route path="/withdraw" element={<RequireAuth><WithdrawPage /></RequireAuth>} />
          <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
          <Route path="/strategy" element={<RequireAuth><StrategyPage /></RequireAuth>} />
          <Route path="/trademaster" element={<RequireAuth><TradeMasterPage /></RequireAuth>} />
          <Route path="/mampamm" element={<RequireAuth><MampammPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/positions" element={<RequireAuth><PositionsPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/ib" element={<RequireAuth><IbPage /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}
