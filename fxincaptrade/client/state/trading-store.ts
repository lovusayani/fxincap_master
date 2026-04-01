import { create } from "zustand";
import { apiUrl } from "@/lib/api";

type AccountSummary = {
  tradingMode: "demo" | "real";
  accountNumber?: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  leverage?: number;
};

type TradingState = {
  account: AccountSummary | null;
  loadAccount: (mode?: "demo" | "real") => Promise<void>;
  setAccount: (account: AccountSummary) => void;
};

export const useTradingStore = create<TradingState>((set, get) => ({
  account: {
    tradingMode: (localStorage.getItem("selected_trading_mode") === "real" ? "real" : "demo"),
    accountNumber: undefined,
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    currency: "USD",
    leverage: 500,
  },
  setAccount: (account) => {
    localStorage.setItem("selected_trading_mode", account.tradingMode || "demo");
    set({ account });
  },
  loadAccount: async (mode) => {
    try {
      const token = localStorage.getItem("auth_token");
      const savedMode = localStorage.getItem("selected_trading_mode");
      const selectedMode = (mode || (savedMode === "real" ? "real" : savedMode === "demo" ? "demo" : undefined) || get().account?.tradingMode || "demo") as "demo" | "real";
      const balanceUrl =
        mode != null
          ? apiUrl(`/api/user/balance?mode=${encodeURIComponent(selectedMode)}`)
          : apiUrl("/api/user/balance");
      const response = await fetch(balanceUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) return;
      const data = await response.json();
      const account = data?.balance || data?.data || data?.account || data || {};

      const nextAccount: AccountSummary = {
        tradingMode: (account.tradingMode || selectedMode || "demo") as "demo" | "real",
        accountNumber: account.accountNumber || account.account_number,
        balance: Number(account.balance || 0),
        equity: Number(account.equity || 0),
        margin: Number(account.margin || 0),
        freeMargin: Number(account.freeMargin || account.margin_free || 0),
        currency: String(account.currency || "USD"),
        leverage: Number(account.leverage || 500),
      };

      localStorage.setItem("selected_trading_mode", nextAccount.tradingMode);

      set({
        account: nextAccount,
      });
    } catch {
      // keep previous state if API is temporarily unavailable
    }
  },
}));
