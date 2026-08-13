import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTradingStore } from "@/state/trading-store";
import { apiUrl } from "@/lib/api";

function normalizeListPayload(json: unknown, keys: string[]): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  entryPrice: number;
  takeProfit: number | null;
  stopLoss: number | null;
  pnl: number;
  status: string;
}

interface Order {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  status: string;
  createdAt: string;
}

const overviewChartMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function PortfolioOverviewChart() {
  return (
    <div className="relative h-[210px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_40%),linear-gradient(180deg,rgba(7,20,25,0.96),rgba(7,20,25,0.82))] p-4 sm:h-[260px] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 bottom-12 top-8 rounded-[24px] border border-white/5 bg-[linear-gradient(180deg,rgba(34,197,94,0.06),rgba(15,23,42,0))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_30%_80%,rgba(45,212,191,0.12),transparent_28%)]" />
      <svg viewBox="0 0 900 240" className="absolute inset-x-5 bottom-10 h-[70%] w-[calc(100%-2.5rem)] opacity-90 sm:inset-x-8">
        <defs>
          <linearGradient id="portfolio-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(45,212,191,0.45)" />
            <stop offset="100%" stopColor="rgba(45,212,191,0.02)" />
          </linearGradient>
        </defs>
        <path
          d="M10 168 C74 144, 86 86, 150 112 S232 190, 292 128 S388 38, 452 104 S544 184, 610 122 S706 18, 776 78 S848 162, 890 84"
          fill="none"
          stroke="rgba(193,243,240,0.42)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M10 178 C72 158, 104 74, 160 114 S242 208, 302 144 S398 28, 454 84 S548 206, 614 112 S698 44, 776 92 S846 164, 890 124 L890 220 L10 220 Z"
          fill="url(#portfolio-chart-fill)"
          stroke="rgba(45,212,191,0.95)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 182 C70 164, 132 118, 190 134 S262 198, 330 168 S430 88, 492 102 S578 194, 636 154 S742 46, 812 108 S868 172, 890 110"
          fill="none"
          stroke="rgba(103,232,249,0.38)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line x1="522" y1="30" x2="522" y2="220" stroke="rgba(148,163,184,0.28)" strokeWidth="2" />
        <circle cx="522" cy="92" r="7" fill="rgba(7,20,25,1)" stroke="rgba(103,232,249,0.9)" strokeWidth="3" />
      </svg>
      <div className="absolute left-5 top-5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-200 sm:left-8 sm:top-7">
        66%
      </div>
      <div className="absolute right-5 top-5 flex items-center gap-2 sm:right-8 sm:top-7">
        {[
          { label: "TM", active: true },
          { label: "TY", active: false },
          { label: "ALL", active: false },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${item.active ? "border border-cyan-400/25 bg-cyan-400/10 text-cyan-100" : "border border-white/10 bg-white/5 text-slate-300"}`}
          >
            {item.label}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-5 bottom-4 flex items-center justify-between text-[10px] font-medium tracking-[0.18em] text-slate-400 sm:inset-x-8">
        {overviewChartMonths.map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyOverviewPanel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(7,20,25,0.95),rgba(6,16,20,0.92))] shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-white">{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
            Empty
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { account, loadAccount } = useTradingStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"positions" | "orders">("positions");
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const fetchData = () => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setLoading(true);
    Promise.all([
      fetch(apiUrl("/api/positions/open"), { headers }).then(async (r) => normalizeListPayload(await r.json(), ["positions", "trades"])),
      fetch(apiUrl("/api/orders"), { headers }).then(async (r) => normalizeListPayload(await r.json(), ["orders"])),
    ])
      .then(([pos, ords]) => {
        setPositions(Array.isArray(pos) ? (pos as Position[]) : []);
        setOrders(Array.isArray(ords) ? (ords as Order[]) : []);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const closePosition = (id: string) => {
    const token = localStorage.getItem("auth_token");
    fetch(apiUrl("/api/positions/close"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ positionId: id }),
    }).then(() => fetchData());
  };

  const cancelOrder = (id: string) => {
    const token = localStorage.getItem("auth_token");
    fetch(apiUrl(`/api/orders/${id}`), {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(() => fetchData());
  };

  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const pendingOrders = useMemo(
    () => orders.filter((order) => String(order.status || "").toLowerCase() === "pending").length,
    [orders]
  );

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account?.currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const activeMode = (account?.tradingMode || "demo").toUpperCase();
  const activeBalance = Number(account?.balance || 0);
  const hiddenBalance = `${account?.currency || "USD"} ••••••`;

  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 pb-1 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-2xl font-semibold text-white">Portfolio Overview</p>
              <p className="mt-1 text-sm text-slate-400">Your global currency positions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-slate-100 hover:bg-white/10">
                + Add Payment
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-slate-100 hover:bg-white/10">
                Send Invoice
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-full border-white/10 bg-white/5 px-3 text-slate-100 hover:bg-white/10">
                ...
              </Button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,24,0.95),rgba(6,16,20,0.92))] p-4 sm:p-5 lg:p-6">
            <div className="absolute inset-y-0 left-0 w-48 bg-[radial-gradient(circle_at_left,rgba(45,212,191,0.18),transparent_62%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-center">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <p className="text-[28px] font-medium tracking-tight">Total Balance</p>
                    <button
                      type="button"
                      onClick={() => setShowBalance((current) => !current)}
                      aria-label={showBalance ? "Hide balance" : "Show balance"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    >
                      {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{showBalance ? formatMoney(activeBalance) : hiddenBalance}</p>
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    {activeMode} account selected
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {account?.accountNumber ? `${activeMode} account: ${account.accountNumber}` : `${activeMode} account active`}
                  </p>
                </div>
              </div>
              <PortfolioOverviewChart />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
            <EmptyOverviewPanel title="App" subtitle="Reserved for future content">
              <div className="h-[260px] rounded-[24px] border border-dashed border-white/10 bg-white/[0.02]" />
            </EmptyOverviewPanel>

            <EmptyOverviewPanel title="Token God Mode" subtitle="Reserved for future content">
              <div className="h-[260px] rounded-[24px] border border-dashed border-white/10 bg-white/[0.02]" />
            </EmptyOverviewPanel>

            <EmptyOverviewPanel title="Analysis" subtitle="Reserved for future content">
              <div className="h-[260px] rounded-[24px] border border-dashed border-white/10 bg-white/[0.02]" />
            </EmptyOverviewPanel>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.28)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Portfolio Control</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Track open positions and pending orders</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Review your current exposure, manage pending orders, and close active trades from one portfolio workspace.
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15 text-gray-200 hover:bg-white/10" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" size="lg" className="h-11 rounded-xl px-5" onClick={() => navigate("/markets")}>
              Open Markets
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Open Positions</p>
                <p className="mt-3 text-3xl font-semibold text-white">{positions.length}</p>
                <p className="mt-2 text-sm text-gray-400">Active trades currently in the market</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-cyan-300">
                <Eye className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Net P&amp;L</p>
                <p className={`mt-3 text-3xl font-semibold ${totalPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {totalPnl >= 0 ? "+" : ""}{formatMoney(totalPnl)}
                </p>
                <p className="mt-2 text-sm text-gray-400">Combined unrealized profit and loss</p>
              </div>
              <div className={`rounded-2xl border border-white/10 bg-black/20 p-3 ${totalPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                <RefreshCw className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Pending Orders</p>
                <p className="mt-3 text-3xl font-semibold text-white">{pendingOrders}</p>
                <p className="mt-2 text-sm text-gray-400">Awaiting trigger or execution</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-amber-300">
                <ArrowRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{tab === "positions" ? "Open Positions" : "Pending Orders"}</CardTitle>
              <p className="mt-1 text-sm text-gray-400">
                {tab === "positions"
                  ? "Monitor active trades, open exposure, and close positions quickly."
                  : "Review orders waiting to be filled and cancel the ones you no longer want."}
              </p>
            </div>
            <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
              {(["positions", "orders"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === value ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  {value === "positions" ? `Positions (${positions.length})` : `Orders (${orders.length})`}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-gray-400">
                Loading portfolio data...
              </div>
            ) : tab === "positions" ? (
              positions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                  <p className="text-sm text-gray-400">No open positions</p>
                  <p className="mt-2 text-xs text-gray-500">Go to Markets to open a new trade.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((pos) => (
                    <div key={pos.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pos.side === "BUY" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                              {pos.side}
                            </span>
                            <span className="text-lg font-semibold text-white">{pos.symbol}</span>
                            <span className="text-sm text-gray-400">{pos.volume} lot</span>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-300 sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Entry Price</p>
                              <p className="mt-1 text-white">{pos.entryPrice}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Take Profit</p>
                              <p className="mt-1 text-white">{pos.takeProfit ?? "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Stop Loss</p>
                              <p className="mt-1 text-white">{pos.stopLoss ?? "-"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="min-w-[180px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Live P&amp;L</p>
                          <p className={`mt-2 text-2xl font-semibold ${pos.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {pos.pnl >= 0 ? "+" : ""}{formatMoney(pos.pnl)}
                          </p>
                          <Button
                            type="button"
                            variant="destructive"
                            className="mt-4 h-10 w-full rounded-xl lg:w-auto"
                            onClick={() => closePosition(pos.id)}
                          >
                            Close Position
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                <p className="text-sm text-gray-400">No pending orders</p>
                <p className="mt-2 text-xs text-gray-500">Create an order from the markets page to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <div key={ord.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-300">{ord.type}</span>
                          <span className="text-lg font-semibold text-white">{ord.symbol}</span>
                          <span className="text-sm text-gray-400">{ord.volume} lot</span>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-300 sm:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Price</p>
                            <p className="mt-1 text-white">{ord.price}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Status</p>
                            <p className="mt-1 capitalize text-white">{ord.status || "pending"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Created</p>
                            <p className="mt-1 text-white">{new Date(ord.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="lg:min-w-[180px] lg:text-right">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full rounded-xl border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 lg:w-auto"
                          onClick={() => cancelOrder(ord.id)}
                        >
                          Cancel Order
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
