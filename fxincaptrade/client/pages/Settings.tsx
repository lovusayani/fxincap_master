import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";
import { useTradingStore } from "@/state/trading-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "demo" | "real";

type UiMessage = {
  text: string;
  ok: boolean;
  actionLabel?: string;
  actionPath?: string;
};

type UserAccount = {
  id: string;
  accountNumber: string;
  tradingMode: Mode;
  balance: number;
  equity: number;
  freeMargin: number;
  currency: string;
  leverage: number;
  isActive: boolean;
  accountTypeId: string | null;
  accountTypeName: string;
  accountTypeDescription: string | null;
  minDeposit: number;
  exposureLimit: number;
};

type AccountTypeOption = {
  id: string;
  name: string;
  description: string | null;
  minDeposit: number;
  leverage: number;
  exposureLimit: number;
  isDemo: boolean;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeAccount(row: any): UserAccount {
  return {
    id: row.id,
    accountNumber: row.accountNumber || row.account_number || "",
    tradingMode: (row.tradingMode || row.trading_mode || "demo") as Mode,
    balance: Number(row.balance || 0),
    equity: Number(row.equity || 0),
    freeMargin: Number(row.freeMargin || row.margin_free || 0),
    currency: String(row.currency || "USD"),
    leverage: Number(row.leverage || 500),
    isActive: Boolean(row.isActive ?? row.is_active),
    accountTypeId: row.accountTypeId || row.account_type_id || null,
    accountTypeName: row.accountTypeName || row.account_type_name || "Standard",
    accountTypeDescription: row.accountTypeDescription ?? row.account_type_description ?? null,
    minDeposit: Number(row.minDeposit || row.min_deposit || 0),
    exposureLimit: Number(row.exposureLimit || row.exposure_limit || 0),
  };
}

function normalizeAccountType(row: any): AccountTypeOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    minDeposit: Number(row.minDeposit || 0),
    leverage: Number(row.leverage || 100),
    exposureLimit: Number(row.exposureLimit || 0),
    isDemo: Boolean(row.isDemo),
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { account, loadAccount } = useTradingStore();
  const [message, setMessage] = useState<UiMessage | null>(null);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [openingTypeId, setOpeningTypeId] = useState<string | null>(null);

  const token = localStorage.getItem("auth_token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(apiUrl("/api/user/accounts"), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAccounts((data.data || []).map(normalizeAccount));
      }
    } catch {
      // keep previous list if the API is temporarily unavailable
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadAccountTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await fetch(apiUrl("/api/user/account-types?type=all"), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAccountTypes((data.data || []).map(normalizeAccountType));
      }
    } catch {
      // keep previous list if the API is temporarily unavailable
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
    void loadAccountTypes();
  }, []);

  const switchToAccount = async (acct: UserAccount) => {
    if (acct.isActive || switchingId) return;
    setSwitchingId(acct.id);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/user/accounts/${acct.id}/activate`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await Promise.all([loadAccounts(), loadAccount(acct.tradingMode)]);
        setMessage({ text: `Now trading on ${acct.accountTypeName} (${acct.tradingMode.toUpperCase()})`, ok: true });
      } else {
        setMessage({ text: data.message || "Failed to switch account", ok: false });
      }
    } catch {
      setMessage({ text: "Network error", ok: false });
    } finally {
      setSwitchingId(null);
    }
  };

  const openAccountOfType = async (type: AccountTypeOption) => {
    if (openingTypeId) return;
    setOpeningTypeId(type.id);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/user/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ accountTypeId: type.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const mode: Mode = type.isDemo ? "demo" : "real";
        await Promise.all([loadAccounts(), loadAccount(mode)]);
        setMessage({ text: data.message || `${type.name} account opened`, ok: true });
      } else if (data.requiresKyc) {
        setMessage({
          ok: false,
          text: "Please complete your KYC verification to open a real account",
          actionLabel: "Go to KYC Page",
          actionPath: "/profile",
        });
      } else {
        setMessage({ text: data.message || "Failed to open account", ok: false });
      }
    } catch {
      setMessage({ text: "Network error", ok: false });
    } finally {
      setOpeningTypeId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("selected_trading_mode");
    navigate("/login");
  };

  const demoAccounts = accounts.filter((a) => a.tradingMode === "demo");
  const realAccounts = accounts.filter((a) => a.tradingMode === "real");
  const openedTypeIds = new Set(accounts.map((a) => a.accountTypeId).filter(Boolean));

  const renderAccountCard = (acct: UserAccount) => {
    const tone = acct.tradingMode === "real" ? "text-emerald-300" : "text-yellow-300";
    return (
      <div
        key={acct.id}
        className={`rounded-lg border p-3 text-xs ${acct.isActive ? "border-blue-400/50 bg-blue-500/10" : "border-white/10 bg-white/5"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{acct.accountTypeName}</p>
            <p className={`text-[10px] font-medium uppercase ${tone}`}>{acct.tradingMode} · 1:{acct.leverage}</p>
          </div>
          {acct.isActive ? (
            <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">Active</span>
          ) : (
            <Button
              onClick={() => switchToAccount(acct)}
              disabled={switchingId === acct.id}
              className="h-7 shrink-0 rounded-md border border-white/10 bg-white/5 px-2 text-[10px] font-semibold text-gray-300 hover:bg-white/10"
            >
              {switchingId === acct.id ? "..." : "Use"}
            </Button>
          )}
        </div>

        <p className="mt-2 truncate text-[10px] text-gray-500">{acct.accountNumber || "—"}</p>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-300">
          <span>Bal: <span className="text-white">{formatMoney(acct.balance, acct.currency)}</span></span>
          <span>Eq: <span className="text-white">{formatMoney(acct.equity, acct.currency)}</span></span>
          <span className="col-span-2">Free: <span className="text-white">{formatMoney(acct.freeMargin, acct.currency)}</span></span>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <h1 className="text-xl font-bold text-white mb-2">Settings</h1>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            <div>{message.text}</div>
            {message.actionPath && message.actionLabel && (
              <Button
                onClick={() => navigate(message.actionPath!)}
                variant="outline"
                className="mt-2 h-8 rounded-md border-white/20 text-xs text-gray-200 hover:bg-white/10"
              >
                {message.actionLabel}
              </Button>
            )}
          </div>
        )}

        {/* Your accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Your Trading Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAccounts ? (
              <p className="text-sm text-gray-400">Loading accounts...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-gray-400">You don't have any accounts yet — open one below to start trading.</p>
            ) : (
              <>
                {realAccounts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Real</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {realAccounts.map(renderAccountCard)}
                    </div>
                  </div>
                )}
                {demoAccounts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Demo</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {demoAccounts.map(renderAccountCard)}
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-gray-600 mt-2">
              Currently trading on: <span className="text-gray-400 font-medium">{(account?.tradingMode || "demo").toUpperCase()}</span> —
              Balance: <span className="text-gray-400">{formatMoney(account?.balance ?? 0, account?.currency || "USD")}</span>
            </p>
          </CardContent>
        </Card>

        {/* Open another account */}
        <Card>
          <CardHeader>
            <CardTitle>Open Another Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Choose any account type your broker offers. Real accounts may require KYC verification.
            </p>
            {loadingTypes ? (
              <p className="text-sm text-gray-400">Loading account types...</p>
            ) : accountTypes.length === 0 ? (
              <p className="text-sm text-gray-400">No account types available. Please contact support.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {accountTypes.map((type) => {
                  const alreadyOpened = openedTypeIds.has(type.id);
                  return (
                    <div key={type.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
                      <p className="truncate text-sm font-semibold text-white">{type.name}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        type.isDemo ? "bg-amber-900/50 text-amber-300" : "bg-emerald-900/50 text-emerald-300"
                      }`}>
                        {type.isDemo ? "Demo" : "Real"}
                      </span>
                      <div className="mt-2 text-gray-500">
                        {type.minDeposit > 0 && <p>Min: ${type.minDeposit.toFixed(2)}</p>}
                        <p>Leverage: 1:{type.leverage}</p>
                      </div>
                      <Button
                        onClick={() => openAccountOfType(type)}
                        disabled={alreadyOpened || openingTypeId === type.id}
                        className={`mt-2 h-7 w-full rounded-md text-[10px] font-semibold ${
                          alreadyOpened
                            ? "border border-white/10 bg-white/5 text-gray-500"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {alreadyOpened ? "Already Opened" : openingTypeId === type.id ? "Opening..." : "Open"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC */}
        <Card>
          <CardHeader>
            <CardTitle>KYC Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">Complete identity verification to unlock live trading</p>
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              className="w-full h-10 rounded-lg border-white/10 text-gray-300 hover:bg-white/10"
            >
              View KYC Status →
            </Button>
          </CardContent>
        </Card>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              className="w-full h-10 justify-start rounded-lg border-white/10 px-3 text-gray-300 hover:bg-white/10"
            >
              Edit Profile
            </Button>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full h-10 rounded-lg border border-red-600/30 bg-red-700/20 text-red-300 hover:bg-red-700/30"
            >
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
