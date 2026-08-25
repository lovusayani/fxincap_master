/**
 * Wallet — total balance, per-account funding history, one-way sweep into the
 * withdrawal wallet, and withdrawals to USDT or a bank account.
 *
 * The withdrawal wallet is separate from trading balance on purpose: funds are
 * swept out of a trading account first, and that sweep cannot be reversed. The
 * UI states this before every transfer, but the rule is enforced server-side.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Wallet as WalletIcon, ShieldAlert, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AccountRow = {
  id: string;
  accountNumber: string;
  balance: number;
  equity: number;
  available: number;
  locked: number;
  currency: string;
  leverage?: number;
  status?: string;
  totalDeposited: number;
  depositCount: number;
  totalSweptToWallet: number;
  sweepCount: number;
};

type RecentRow = {
  id: string;
  type: string;
  amount: number;
  method?: string | null;
  status: string;
  reference_number?: string | null;
  created_at: string;
  fee_amount?: number | null;
  net_amount?: number | null;
};

type TransferRow = { id: string; account_number?: string | null; amount: number; created_at: string };

type FeeRule = {
  method: "usdt" | "bank";
  enabled: boolean;
  fee_type: "percent" | "fixed";
  fee_value: number;
  min_fee: number;
  max_fee: number | null;
  min_amount: number;
  max_amount: number | null;
};

type Summary = {
  walletBalance: number;
  tradingBalance: number;
  totalBalance: number;
  totals: { deposited: number; withdrawn: number; pendingWithdrawal: number; pendingDeposit: number };
  accounts: AccountRow[];
  recent: RecentRow[];
  transfers: TransferRow[];
  kycApproved: boolean;
};

const money = (n: unknown) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const token = () => localStorage.getItem("token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const cls =
    s === "completed" ? "bg-emerald-500/15 text-emerald-400"
    : s === "rejected" || s === "failed" ? "bg-red-500/15 text-red-400"
    : "bg-amber-500/15 text-amber-400";
  const label = s === "pending" || s === "processing" ? "In process" : s.charAt(0).toUpperCase() + s.slice(1);
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Summary | null>(null);
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [sRes, fRes] = await Promise.all([
        fetch(apiUrl("/api/user/wallet/summary"), { headers: authH() }),
        fetch(apiUrl("/api/user/wallet/fees"), { headers: authH() }),
      ]);
      const sJson = await sRes.json();
      if (sJson.success) setData(sJson.data);
      else setError(sJson.error || "Failed to load wallet");
      const fJson = await fRes.json();
      if (fJson.success) setFees(fJson.data || []);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const realAccounts = useMemo(() => data?.accounts ?? [], [data]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="mx-auto max-w-6xl p-4 space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Wallet</h1>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        {/* Headline balances */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-[#101321] border-white/10 sm:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-white/60">Total Balance</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{money(data?.totalBalance)}</p>
              <p className="mt-1 text-xs text-white/50">
                Trading {money(data?.tradingBalance)} · Withdrawal wallet {money(data?.walletBalance)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate("/deposit")}>
                  <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Add Deposit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowTransfer(true)}>
                  <ArrowRight className="mr-1.5 h-4 w-4" /> Transfer to Wallet
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowWithdraw(true)}>
                  <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#101321] border-white/10">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-white/60">Withdrawal Wallet</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-400">{money(data?.walletBalance)}</p>
              <p className="mt-1 text-xs text-white/50">Available to withdraw</p>
            </CardContent>
          </Card>

          <Card className="bg-[#101321] border-white/10">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-white/60">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Deposited</span><span className="font-medium">{money(data?.totals.deposited)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Withdrawn</span><span className="font-medium">{money(data?.totals.withdrawn)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">In process</span><span className="font-medium text-amber-400">{money(data?.totals.pendingWithdrawal)}</span></div>
            </CardContent>
          </Card>
        </div>

        {!data?.kycApproved && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-amber-300">KYC verification required to withdraw</p>
              <p className="text-xs text-amber-200/70">You can deposit and transfer, but withdrawals stay locked until your KYC is approved.</p>
              <Button size="sm" variant="link" className="h-auto p-0 text-amber-300" onClick={() => navigate("/profile")}>
                Complete KYC →
              </Button>
            </div>
          </div>
        )}

        {/* Account-wise breakdown */}
        <Card className="bg-[#101321] border-white/10">
          <CardHeader><CardTitle className="text-sm">Accounts</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Total Deposited</TableHead>
                  <TableHead className="text-right">Moved to Wallet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realAccounts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-white/40">No real accounts yet</TableCell></TableRow>
                ) : realAccounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.accountNumber}</TableCell>
                    <TableCell className="text-right">{money(a.balance)}</TableCell>
                    <TableCell className="text-right text-white/70">{money(a.available)}</TableCell>
                    <TableCell className="text-right text-emerald-400">{money(a.totalDeposited)}</TableCell>
                    <TableCell className="text-right text-amber-400">{money(a.totalSweptToWallet)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent deposits & withdrawals */}
        <Card className="bg-[#101321] border-white/10">
          <CardHeader><CardTitle className="text-sm">Recent Transactions</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recent ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-white/40">No transactions yet</TableCell></TableRow>
                ) : data!.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{r.type}</TableCell>
                    <TableCell className="uppercase text-xs text-white/60">{r.method || "—"}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="text-right text-white/60">{r.fee_amount != null ? money(r.fee_amount) : "—"}</TableCell>
                    <TableCell className="text-right">{r.net_amount != null ? money(r.net_amount) : "—"}</TableCell>
                    <TableCell><StatusPill status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sweep history */}
        {(data?.transfers ?? []).length > 0 && (
          <Card className="bg-[#101321] border-white/10">
            <CardHeader><CardTitle className="text-sm">Transfers to Withdrawal Wallet</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>From Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data!.transfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{t.account_number || "—"}</TableCell>
                      <TableCell className="text-right">{money(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {showTransfer && (
        <TransferModal accounts={realAccounts} onClose={() => setShowTransfer(false)} onDone={() => { setShowTransfer(false); load(); }} />
      )}
      {showWithdraw && (
        <WithdrawModal
          fees={fees}
          walletBalance={data?.walletBalance ?? 0}
          kycApproved={!!data?.kycApproved}
          onClose={() => setShowWithdraw(false)}
          onDone={() => { setShowWithdraw(false); load(); }}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#101321] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white";

/** One-way sweep from a real account into the withdrawal wallet. */
function TransferModal({ accounts, onClose, onDone }: { accounts: AccountRow[]; onClose: () => void; onDone: () => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const selected = accounts.find((a) => a.id === accountId);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(apiUrl("/api/user/wallet/transfer"), {
        method: "POST", headers: authH(), body: JSON.stringify({ accountId, amount: Number(amount) }),
      });
      const json = await res.json();
      if (json.success) onDone();
      else setErr(json.error || "Transfer failed");
    } catch { setErr("Request failed"); } finally { setBusy(false); }
  };

  return (
    <Modal title="Transfer to Withdrawal Wallet" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          This is one-way. Funds moved into the withdrawal wallet cannot be returned to a trading account.
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/60">From account</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.accountNumber} — {money(a.available)} available</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/60">Amount</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          {selected && (
            <button type="button" className="mt-1 text-xs text-emerald-400" onClick={() => setAmount(String(selected.available))}>
              Use max ({money(selected.available)})
            </button>
          )}
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={submit} disabled={busy || !accountId || !(Number(amount) > 0)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Transfer"}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Withdraw from the wallet to USDT or a bank account. */
function WithdrawModal({
  fees, walletBalance, kycApproved, onClose, onDone,
}: { fees: FeeRule[]; walletBalance: number; kycApproved: boolean; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState<"usdt" | "bank">("usdt");
  const [amount, setAmount] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{ fee: number; net: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rule = fees.find((f) => f.method === method);

  // Fee preview comes from the server so the trader never sees a figure the
  // backend would disagree with.
  useEffect(() => {
    const amt = Number(amount);
    if (!(amt > 0)) { setQuote(null); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl("/api/user/wallet/quote"), {
          method: "POST", headers: authH(), body: JSON.stringify({ method, amount: amt }),
        });
        const json = await res.json();
        if (!cancelled) {
          if (json.success) { setQuote(json.data); setErr(""); }
          else { setQuote(null); setErr(json.error || ""); }
        }
      } catch { /* preview only */ }
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [amount, method]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(apiUrl("/api/user/wallet/withdraw"), {
        method: "POST", headers: authH(), body: JSON.stringify({ method, amount: Number(amount), ...form }),
      });
      const json = await res.json();
      if (json.success) onDone();
      else setErr(json.error || "Withdrawal failed");
    } catch { setErr("Request failed"); } finally { setBusy(false); }
  };

  if (!kycApproved) {
    return (
      <Modal title="Withdraw" onClose={onClose}>
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-300">
            Your KYC must be approved before you can withdraw.
          </div>
          <Button className="w-full" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Withdraw" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-white/50">Available in withdrawal wallet: <span className="font-medium text-emerald-400">{money(walletBalance)}</span></p>

        <div className="grid grid-cols-2 gap-2">
          {(["usdt", "bank"] as const).map((m) => {
            const r = fees.find((f) => f.method === m);
            const disabled = r ? !r.enabled : false;
            return (
              <button key={m} type="button" disabled={disabled} onClick={() => setMethod(m)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
                  method === m ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-white/15 text-white/70"}`}>
                {m === "usdt" ? "USDT" : "Bank Account"}
              </button>
            );
          })}
        </div>

        {rule && (
          <p className="text-xs text-white/50">
            Charge: {rule.fee_type === "percent" ? `${rule.fee_value}%` : money(rule.fee_value)}
            {rule.min_fee > 0 && ` (min ${money(rule.min_fee)})`}
            {rule.max_fee != null && ` (max ${money(rule.max_fee)})`}
            {rule.min_amount > 0 && ` · Min amount ${money(rule.min_amount)}`}
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs text-white/60">Amount</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
        </div>

        {quote && (
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-white/50">Deducted from wallet</span><span>{money(Number(amount))}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Charge</span><span className="text-amber-400">-{money(quote.fee)}</span></div>
            <div className="flex justify-between font-medium"><span>You receive</span><span className="text-emerald-400">{money(quote.net)}</span></div>
          </div>
        )}

        {method === "usdt" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-white/60">USDT Address</label>
              <input value={form.usdtAddress || ""} onChange={(e) => set("usdtAddress", e.target.value)} placeholder="Wallet address" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Network</label>
              <select value={form.usdtNetwork || ""} onChange={(e) => set("usdtNetwork", e.target.value)} className={inputCls}>
                <option value="">Select network</option>
                <option value="TRC20">TRC20</option>
                <option value="ERC20">ERC20</option>
                <option value="BEP20">BEP20</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs text-white/60">Account Holder Name</label>
              <input value={form.bankAccountName || ""} onChange={(e) => set("bankAccountName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Account Number</label>
              <input value={form.bankAccountNumber || ""} onChange={(e) => set("bankAccountNumber", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Bank Name</label>
              <input value={form.bankName || ""} onChange={(e) => set("bankName", e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-white/60">IFSC</label>
                <input value={form.bankIfsc || ""} onChange={(e) => set("bankIfsc", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">SWIFT</label>
                <input value={form.bankSwift || ""} onChange={(e) => set("bankSwift", e.target.value)} className={inputCls} />
              </div>
            </div>
          </>
        )}

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={submit} disabled={busy || !quote}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Withdrawal"}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
