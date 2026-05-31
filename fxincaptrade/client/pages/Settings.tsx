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

type AccountActivationSettings = {
  realAccountActivationEnabled: boolean;
  kycRequiredForRealAccount: boolean;
};

type ModeAccount = {
  tradingMode: Mode;
  accountNumber?: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  leverage: number;
  available: boolean;
};

function emptyModeAccount(mode: Mode): ModeAccount {
  return {
    tradingMode: mode,
    accountNumber: undefined,
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    currency: "USD",
    leverage: 500,
    available: false,
  };
}

function normalizeModeAccount(payload: any, mode: Mode): ModeAccount {
  const raw = payload?.balance || payload?.data || payload?.account || payload || {};

  return {
    tradingMode: mode,
    accountNumber: raw.accountNumber || raw.account_number,
    balance: Number(raw.balance || 0),
    equity: Number(raw.equity || 0),
    margin: Number(raw.margin || 0),
    freeMargin: Number(raw.freeMargin || raw.margin_free || 0),
    currency: String(raw.currency || "USD"),
    leverage: Number(raw.leverage || 500),
    available: Boolean(raw.accountNumber || raw.account_number),
  };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { account, loadAccount, setAccount } = useTradingStore();
  const [switching, setSwitching] = useState(false);
  const [activatingReal, setActivatingReal] = useState(false);
  const [message, setMessage] = useState<UiMessage | null>(null);
  const [activationSettings, setActivationSettings] = useState<AccountActivationSettings>({
    realAccountActivationEnabled: true,
    kycRequiredForRealAccount: true,
  });
  const [kycStatus, setKycStatus] = useState<string>("pending");
  const [accountsByMode, setAccountsByMode] = useState<{ demo: ModeAccount; real: ModeAccount }>({
    demo: emptyModeAccount("demo"),
    real: emptyModeAccount("real"),
  });
  const [showAccountTypeModal, setShowAccountTypeModal] = useState(false);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [loadingAccountTypes, setLoadingAccountTypes] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);

  const token = localStorage.getItem("auth_token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadModeAccounts = async () => {
    const [demoRes, realRes] = await Promise.all([
      fetch(apiUrl("/api/user/balance?mode=demo"), { headers: authHeaders }),
      fetch(apiUrl("/api/user/balance?mode=real"), { headers: authHeaders }),
    ]);

    const nextDemo = demoRes.ok
      ? normalizeModeAccount(await demoRes.json(), "demo")
      : emptyModeAccount("demo");
    const nextReal = realRes.ok
      ? normalizeModeAccount(await realRes.json(), "real")
      : emptyModeAccount("real");

    setAccountsByMode({ demo: nextDemo, real: nextReal });
  };

  const loadActivationContext = async () => {
    try {
      const [settingsRes, kycRes] = await Promise.all([
        fetch(apiUrl("/api/user/account-activation-settings"), { headers: authHeaders }),
        fetch(apiUrl("/api/user/kyc"), { headers: authHeaders }),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData?.success && settingsData?.data) {
          setActivationSettings({
            realAccountActivationEnabled: settingsData.data.realAccountActivationEnabled !== false,
            kycRequiredForRealAccount: settingsData.data.kycRequiredForRealAccount !== false,
          });
        }
      }

      if (kycRes.ok) {
        const kycData = await kycRes.json();
        setKycStatus(String(kycData?.kyc?.status || "pending").toLowerCase());
      }
    } catch {
      // Keep defaults when API is temporarily unavailable.
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        await Promise.all([loadModeAccounts(), loadActivationContext()]);
      } catch {
        setAccountsByMode({ demo: emptyModeAccount("demo"), real: emptyModeAccount("real") });
      }
    };

    void loadAll();
  }, [account?.tradingMode]);

  const switchMode = async (mode: Mode) => {
    if (account?.tradingMode === mode) return;
    setSwitching(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/user/trading-mode"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ tradingMode: mode, mode }),
      });
      if (res.ok) {
        const payload = await res.json();
        const selected = normalizeModeAccount(payload, mode);
        setAccount(selected);
        await loadAccount(mode);
        setMessage({ text: `Switched to ${mode.toUpperCase()} account`, ok: true });
      } else {
        const fallback = accountsByMode[mode];
        if (fallback?.available) {
          setAccount(fallback);
          await loadAccount(mode);
          setMessage({ text: `Switched to ${mode.toUpperCase()} account (local mode)`, ok: true });
        } else {
          const data = await res.json();
          setMessage({ text: data.message || "Switch failed", ok: false });
        }
      }
    } catch {
      setMessage({ text: "Network error", ok: false });
    } finally {
      setSwitching(false);
    }
  };

  const loadAccountTypes = async () => {
    setLoadingAccountTypes(true);
    try {
      const res = await fetch(apiUrl("/api/user/account-types?type=real"), {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setAccountTypes(data.data || []);
      }
    } catch {
      setMessage({ ok: false, text: "Failed to load account types" });
    } finally {
      setLoadingAccountTypes(false);
    }
  };

  const activateRealAccount = async () => {
    setMessage(null);

    if (!activationSettings.realAccountActivationEnabled) {
      setMessage({
        ok: false,
        text: "Real account activation is currently unavailable, please contact support for more information",
      });
      return;
    }

    if (!accountsByMode.demo.available) {
      setMessage({ ok: false, text: "Please create a demo account first" });
      return;
    }

    if (
      activationSettings.kycRequiredForRealAccount &&
      !["approved", "verified"].includes(String(kycStatus || "pending").toLowerCase())
    ) {
      setMessage({
        ok: false,
        text: "Please complete your KYC verification to activate real account",
        actionLabel: "Go to KYC Page",
        actionPath: "/profile",
      });
      return;
    }

    setShowAccountTypeModal(true);
    await loadAccountTypes();
  };

  const confirmRealAccountActivation = async () => {
    if (!selectedAccountType) {
      setMessage({ ok: false, text: "Please select an account type" });
      return;
    }

    setActivatingReal(true);
    setShowAccountTypeModal(false);
    setMessage({ ok: true, text: "Your real account is being activated, please wait..." });

    try {
      const res = await fetch(apiUrl("/api/user/activate-real-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ accountTypeId: selectedAccountType }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        const errorText =
          data?.message ||
          "Failed to activate real account, please try again later";

        if (data?.requiresKyc) {
          setMessage({
            ok: false,
            text: "Please complete your KYC verification to activate real account",
            actionLabel: "Go to KYC Page",
            actionPath: "/profile",
          });
        } else {
          setMessage({ ok: false, text: errorText });
        }
        return;
      }

      await Promise.all([loadModeAccounts(), loadActivationContext()]);
      await loadAccount("real");

      setMessage({
        ok: true,
        text: data?.message || "Your real account has been activated successfully",
      });
      setSelectedAccountType(null);
    } catch {
      setMessage({
        ok: false,
        text: "Failed to activate real account, please try again later",
      });
    } finally {
      setActivatingReal(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("selected_trading_mode");
    navigate("/login");
  };

  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <h1 className="text-xl font-bold text-white mb-2">Settings</h1>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}>
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

        {/* Trading mode */}
        <Card>
          <CardHeader>
            <CardTitle>Trading Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {(["real", "demo"] as const).map((m) => {
                const modeAccount = accountsByMode[m];
                const selected = account?.tradingMode === m;
                const tone = m === "real" ? "text-emerald-300" : "text-yellow-300";

                return (
                  <div
                    key={m}
                    className={`rounded-xl border p-4 ${selected
                      ? "border-blue-400/50 bg-blue-500/10"
                      : "border-white/10 bg-white/5"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm font-semibold uppercase ${tone}`}>{m === "demo" ? "Demo" : "Real"}</p>
                      <Button
                        onClick={() => {
                          if (m === "real" && !modeAccount.available) {
                            void activateRealAccount();
                            return;
                          }
                          void switchMode(m);
                        }}
                        disabled={
                          switching ||
                          activatingReal ||
                          selected ||
                          (m === "real" ? false : !modeAccount.available)
                        }
                        className={`h-9 rounded-lg px-3 text-xs font-semibold ${selected
                          ? "bg-blue-600 text-white"
                          : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                      >
                        {selected
                          ? "Selected"
                          : m === "real" && !modeAccount.available
                            ? (activatingReal ? "Activating..." : "Activate Real Account")
                            : "Select"}
                      </Button>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-gray-300">
                      <p>Account: {modeAccount.accountNumber || "Not available"}</p>
                      <p>Balance: <span className="text-white">{formatMoney(modeAccount.balance, modeAccount.currency)}</span></p>
                      <p>Equity: <span className="text-white">{formatMoney(modeAccount.equity, modeAccount.currency)}</span></p>
                      <p>Free Margin: <span className="text-white">{formatMoney(modeAccount.freeMargin, modeAccount.currency)}</span></p>
                      <p className="text-xs text-gray-400">Leverage: 1:{modeAccount.leverage || 500}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-600 mt-2">
              Current: <span className="text-gray-400 font-medium">{(account?.tradingMode || "demo").toUpperCase()}</span> —
              Balance: <span className="text-gray-400">{formatMoney(account?.balance ?? 0, account?.currency || "USD")}</span>
            </p>
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

        {/* Account Type Selection Modal */}
        {showAccountTypeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-2">Select Account Type</h2>
              <p className="text-sm text-gray-400 mb-4">Choose the account type that best suits your trading needs</p>

              {loadingAccountTypes ? (
                <div className="text-center py-6 text-gray-400">Loading account types...</div>
              ) : accountTypes.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">No account types available. Please contact support.</div>
              ) : (
                <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                  {accountTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedAccountType(type.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedAccountType === type.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-white">{type.name}</p>
                          {type.description && (
                            <p className="text-xs text-gray-400 mt-1">{type.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            {type.minDeposit > 0 && (
                              <span>Min: ${type.minDeposit.toFixed(2)}</span>
                            )}
                            <span>Leverage: 1:{type.leverage}</span>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border-2 mt-1 flex-shrink-0 flex items-center justify-center ${
                            selectedAccountType === type.id
                              ? "border-blue-500 bg-blue-500"
                              : "border-white/20"
                          }`}
                        >
                          {selectedAccountType === type.id && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowAccountTypeModal(false);
                    setSelectedAccountType(null);
                  }}
                  variant="outline"
                  className="flex-1 h-10 rounded-lg border-white/10 text-gray-300 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRealAccountActivation}
                  disabled={activatingReal || loadingAccountTypes || !selectedAccountType}
                  className="flex-1 h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activatingReal ? "Activating..." : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
