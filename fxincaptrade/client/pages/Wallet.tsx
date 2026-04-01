import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CreditCard, RefreshCw, Wallet } from "lucide-react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type DepositOffer = {
  id: string;
  title: string;
  description: string;
  badge?: string | null;
};

type DepositRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  method?: string | null;
  paymentChain?: string | null;
  createdAt: string;
};

type RealBalanceSummary = {
  balance: number;
  equity: number;
  freeMargin: number;
  currency: string;
  accountNumber?: string;
};

type WeeklyDepositPoint = {
  label: string;
  amount: number;
};

const ROWS_PER_PAGE = 8;

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const statusTone = (status: string) => {
  const value = String(status || "").toLowerCase();
  if (value === "approved" || value === "completed") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/20";
  if (value === "rejected" || value === "failed") return "bg-rose-500/20 text-rose-300 border-rose-500/20";
  return "bg-amber-500/20 text-amber-300 border-amber-500/20";
};

function getMonthWeekBuckets(rows: DepositRow[]): WeeklyDepositPoint[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const points = [0, 0, 0, 0, 0];

  for (const row of rows) {
    const createdAt = new Date(row.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    if (createdAt < monthStart || createdAt >= nextMonthStart) {
      continue;
    }

    const normalizedStatus = String(row.status || "").toLowerCase();
    if (normalizedStatus !== "approved" && normalizedStatus !== "completed") {
      continue;
    }

    const dayOfMonth = createdAt.getDate();
    const bucketIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), points.length - 1);
    points[bucketIndex] += Number(row.amount || 0);
  }

  return points.map((amount, index) => ({
    label: `Week ${index + 1}`,
    amount,
  }));
}

function buildPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

export default function WalletPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<DepositOffer[]>([]);
  const [depositRows, setDepositRows] = useState<DepositRow[]>([]);
  const [realBalance, setRealBalance] = useState<RealBalanceSummary>({
    balance: 0,
    equity: 0,
    freeMargin: 0,
    currency: "USD",
    accountNumber: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const token = localStorage.getItem("auth_token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    let active = true;

    const loadWalletData = async () => {
      setLoading(true);
      try {
        const [balanceResponse, offersResponse, requestsResponse] = await Promise.all([
          fetch(apiUrl("/api/user/balance?mode=real"), { headers: authHeaders }),
          fetch(apiUrl("/api/user/deposit-offers"), { headers: authHeaders }),
          fetch(apiUrl("/api/user/fund-requests"), { headers: authHeaders }),
        ]);

        const nextBalance: RealBalanceSummary = {
          balance: 0,
          equity: 0,
          freeMargin: 0,
          currency: "USD",
          accountNumber: undefined,
        };

        if (balanceResponse.ok) {
          const balancePayload = await balanceResponse.json();
          const account = balancePayload?.balance || balancePayload?.data || balancePayload?.account || {};
          nextBalance.balance = Number(account.balance || 0);
          nextBalance.equity = Number(account.equity || 0);
          nextBalance.freeMargin = Number(account.freeMargin ?? account.availableBalance ?? 0);
          nextBalance.currency = account.currency || "USD";
          nextBalance.accountNumber = account.accountNumber || account.account_number || undefined;
        }

        const offersPayload = offersResponse.ok ? await offersResponse.json() : null;
        const requestsPayload = requestsResponse.ok ? await requestsResponse.json() : null;
        const nextRows = Array.isArray(requestsPayload?.requests)
          ? requestsPayload.requests.filter((item: DepositRow & { type?: string }) => String(item?.type || "").toLowerCase() === "deposit")
          : [];

        if (!active) {
          return;
        }

        setRealBalance(nextBalance);
        setOffers(Array.isArray(offersPayload?.data) ? offersPayload.data : []);
        setDepositRows(nextRows);
      } catch {
        if (!active) {
          return;
        }

        setOffers([]);
        setDepositRows([]);
        setRealBalance({
          balance: 0,
          equity: 0,
          freeMargin: 0,
          currency: "USD",
          accountNumber: undefined,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadWalletData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(depositRows.length / ROWS_PER_PAGE));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [depositRows.length, page]);

  const weeklyDepositData = useMemo(() => getMonthWeekBuckets(depositRows), [depositRows]);
  const totalDepositAmount = useMemo(
    () => depositRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [depositRows]
  );
  const totalPages = Math.max(1, Math.ceil(depositRows.length / ROWS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    return depositRows.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [depositRows, page]);
  const paginationItems = buildPaginationItems(page, totalPages);

  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.28)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Wallet Center</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Manage deposits and monitor wallet activity</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Review monthly deposit movement, active promotions, and your deposit request history from one page.
            </p>
          </div>
          <Button type="button" size="lg" className="h-11 rounded-xl px-5" onClick={() => navigate("/deposit")}>
            Add Deposit
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-5 rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Monthly Deposit Trend</CardTitle>
              <p className="text-sm text-gray-400">Approved deposits grouped by week for the current month.</p>
            </CardHeader>
            <CardContent>
              <div className="h-72 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900/50 to-emerald-500/10 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyDepositData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(34,197,94,0.08)" }}
                      contentStyle={{
                        background: "rgba(2,6,23,0.94)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: "12px",
                        color: "#f8fafc",
                      }}
                      formatter={(value: number) => [formatMoney(value), "Deposited"]}
                    />
                    <Bar dataKey="amount" radius={[10, 10, 0, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4 rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Deposit Offers</CardTitle>
                <p className="mt-1 text-sm text-gray-400">Live promotional offers pulled from admin settings.</p>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                {offers.length} active
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {offers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-gray-400">
                  No active deposit offers right now.
                </div>
              ) : (
                offers.slice(0, 3).map((offer) => (
                  <div key={offer.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-white">{offer.title}</p>
                      {offer.badge ? (
                        <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">{offer.badge}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{offer.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-3 rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Real Balance Overview</CardTitle>
              <p className="mt-1 text-sm text-gray-400">Your current real wallet balance and total deposit volume.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3 text-emerald-200">
                  <Wallet className="h-5 w-5" />
                  <span className="text-xs uppercase tracking-[0.18em]">Real Balance</span>
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{formatMoney(realBalance.balance, realBalance.currency)}</p>
                <p className="mt-2 text-sm text-emerald-100/80">
                  Equity: {formatMoney(realBalance.equity, realBalance.currency)}
                </p>
                <p className="text-sm text-emerald-100/80">
                  Free Margin: {formatMoney(realBalance.freeMargin, realBalance.currency)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3 text-gray-300">
                  <CreditCard className="h-5 w-5 text-cyan-300" />
                  <span className="text-xs uppercase tracking-[0.18em]">Total Deposits</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">{formatMoney(totalDepositAmount, realBalance.currency)}</p>
                <p className="mt-2 text-sm text-gray-400">
                  {realBalance.accountNumber ? `Real account: ${realBalance.accountNumber}` : "Real account number not available"}
                </p>
              </div>

              <Button type="button" size="lg" className="h-11 w-full rounded-xl" onClick={() => navigate("/deposit")}>
                Add Deposit
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Deposit Report</CardTitle>
              <p className="mt-1 text-sm text-gray-400">All deposit requests for this user with current approval status.</p>
            </div>
            <Button type="button" variant="outline" className="h-10 rounded-xl border-white/15 text-gray-200 hover:bg-white/10" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-gray-400">
                Loading wallet report...
              </div>
            ) : depositRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-gray-400">
                No deposit requests found for this user yet.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-white">{row.reference || row.id}</TableCell>
                        <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{row.paymentMethod || row.method || "Manual"}</TableCell>
                        <TableCell>{row.paymentChain || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-white">{formatMoney(Number(row.amount || 0), realBalance.currency)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusTone(row.status)}`}>
                            {row.status || "pending"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Showing {(page - 1) * ROWS_PER_PAGE + 1} to {Math.min(page * ROWS_PER_PAGE, depositRows.length)} of {depositRows.length} deposits
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} />
                      </PaginationItem>
                      {paginationItems.map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {item === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink isActive={page === item} onClick={() => setPage(Number(item))}>
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
