import React, { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";

const token = () => localStorage.getItem("auth_token") || "";
const authH = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });
const fmt = (v: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(v) || 0);

type Master = {
  id: string; name: string; email: string; strategy: string;
  profit_share: number; min_copy_amount: number; total_pnl: number;
  followers: number; copied_trades: number; win_rate: number;
  status: string; is_following?: boolean;
};
type TradingAccount = { id: string; account_number: string; trading_mode: string; balance: number };
type Subscription = {
  id: string; master_id: string; master_name: string; copy_amount: number;
  total_profit: number; trades_copied: number; status: string; created_at: string;
};
type CopiedTrade = {
  id: string; master_name: string; symbol: string; side: string; volume: number;
  entry_price: number; close_price: number; pnl: number; status: string; opened_at: string;
};

// ─── Apply Modal ──────────────────────────────────────────────
function ApplyModal({ accounts, onClose }: { accounts: TradingAccount[]; onClose: () => void }) {
  const [form, setForm] = useState({ display_name: "", description: "", account_id: "", commission: "10" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.display_name.trim()) { setError("Display name is required"); return; }
    if (!form.account_id) { setError("Please select a trading account"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(apiUrl("/api/user/mampam/apply"), {
        method: "POST", headers: authH(),
        body: JSON.stringify({ name: form.display_name, strategy: form.description, account_id: form.account_id, profit_share: Number(form.commission) }),
      });
      const json = await res.json();
      if (json.success) setDone(true);
      else setError(json.error || "Failed to submit");
    } catch { setError("Network error, please try again"); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }} onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="px-8 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-3xl">👑</div>
            <h3 className="text-white font-bold text-xl mb-2">Application Submitted!</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">Your master trader application is under review. You'll be notified once approved by an admin.</p>
            <button onClick={onClose} className="w-full py-3.5 rounded-xl font-bold text-black text-sm" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>Done</button>
          </div>
        ) : (
          <>
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-xl flex-shrink-0">👑</div>
                <div>
                  <h3 className="text-white font-bold">Become a Master Trader</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Share your trades with followers</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {error && <div className="rounded-xl bg-red-900/25 border border-red-700/40 px-4 py-2.5 text-xs text-red-400">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">Display Name <span className="text-red-400">*</span></label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Your trading name"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:bg-white/8 focus:outline-none transition" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Tell followers about your trading strategy..."
                  rows={3}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none resize-none transition" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">Trading Account <span className="text-red-400">*</span></label>
                <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none transition appearance-none"
                  style={{ backgroundColor: "#1c1c1c" }}>
                  <option value="">No accounts available</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} style={{ backgroundColor: "#1c1c1c" }}>
                      #{a.account_number} — {a.trading_mode} ({fmt(a.balance)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1.5">Trades from this account will be copied to followers</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">Requested Commission (%)</label>
                <input type="number" min="0" max="50" value={form.commission}
                  onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none transition" />
                <p className="text-xs text-gray-600 mt-1.5">Commission you'll earn from followers' daily profits (0–50%)</p>
              </div>

              <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3.5">
                <p className="text-xs font-semibold text-gray-300 mb-2.5">Requirements:</p>
                <ul className="space-y-1.5">
                  {["Minimum account balance may be required", "Trading history will be reviewed", "Admin approval is required"].map(r => (
                    <li key={r} className="text-xs text-gray-500 flex items-start gap-2">
                      <span className="mt-0.5 text-gray-600">•</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/5 transition">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 rounded-xl text-black text-sm font-bold disabled:opacity-60 transition"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Follow Modal ─────────────────────────────────────────────
function FollowModal({ master, accounts, onClose, onDone }: {
  master: Master; accounts: TradingAccount[]; onClose: () => void; onDone: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [copyAmount, setCopyAmount] = useState(String(master.min_copy_amount || 100));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleFollow = async () => {
    if (!accountId) { setError("Please select a trading account"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(apiUrl(`/api/user/mampam/follow/${master.id}`), {
        method: "POST", headers: authH(),
        body: JSON.stringify({ account_id: accountId, copy_amount: Number(copyAmount) }),
      });
      const json = await res.json();
      if (json.success) { onDone(); onClose(); }
      else setError(json.error || "Failed to follow");
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }} onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-sm font-bold text-cyan-400 flex-shrink-0">
              {(master.name || "M")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold">Copy {master.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{master.profit_share}% commission on your profits</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="rounded-xl bg-red-900/25 border border-red-700/40 px-4 py-2.5 text-xs text-red-400">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Select Account <span className="text-red-400">*</span></label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition appearance-none"
              style={{ backgroundColor: "#1c1c1c" }}>
              <option value="">Choose account</option>
              {accounts.map(a => <option key={a.id} value={a.id} style={{ backgroundColor: "#1c1c1c" }}>#{a.account_number} ({fmt(a.balance)})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Copy Amount (USD)</label>
            <input type="number" value={copyAmount} onChange={e => setCopyAmount(e.target.value)} min={master.min_copy_amount || 0}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition" />
            <p className="text-xs text-gray-600 mt-1.5">Minimum: {fmt(master.min_copy_amount)}</p>
          </div>
        </div>
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition">Cancel</button>
          <button onClick={handleFollow} disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 disabled:opacity-60 transition">
            {submitting ? "Following…" : "Start Copying"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discover Tab ─────────────────────────────────────────────
function DiscoverTab({ accounts, onRefresh }: { accounts: TradingAccount[]; onRefresh: () => void }) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [followTarget, setFollowTarget] = useState<Master | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/user/mampam/masters"), { headers: { Authorization: `Bearer ${token()}` } });
      const json = await res.json();
      if (json.success) setMasters(json.data || []);
    } catch { setMasters([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = masters.filter(m =>
    !search || (m.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.strategy || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search masters..."
          className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:bg-white/8 focus:outline-none transition" />
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-500 text-sm">Loading masters…</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-3xl">⭐</div>
          <p className="text-gray-400 font-medium mb-1">No master traders yet</p>
          <p className="text-gray-600 text-sm">Be the first to apply and start sharing your trades</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-2xl p-5 flex flex-col" style={{ background: "linear-gradient(160deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Top */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-base font-bold text-teal-400 flex-shrink-0">
                  {(m.name || "M")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{m.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{m.followers} follower{m.followers !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {m.strategy && (
                <p className="text-gray-500 text-xs mb-4 line-clamp-2 leading-relaxed">{m.strategy}</p>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4 flex-1">
                {[
                  { label: "Win Rate", value: `${(Number(m.win_rate) || 0).toFixed(1)}%`, color: "text-white" },
                  { label: "Total Trades", value: String(m.copied_trades || 0), color: "text-white" },
                  { label: "Commission", value: `${m.profit_share}%`, color: "text-amber-400" },
                  { label: "Profit", value: fmt(m.total_pnl), color: Number(m.total_pnl) >= 0 ? "text-cyan-400" : "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Button */}
              {m.is_following ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm font-medium text-cyan-400" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
                  ✓ Following
                </div>
              ) : (
                <button onClick={() => setFollowTarget(m)}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition active:scale-95">
                  Follow
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {followTarget && (
        <FollowModal master={followTarget} accounts={accounts} onClose={() => setFollowTarget(null)} onDone={() => { load(); onRefresh(); }} />
      )}
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────
function SubscriptionsTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl("/api/user/mampam/subscriptions"), { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(j => { if (j.success) setSubs(j.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUnfollow = async (id: string) => {
    if (!confirm("Stop copying this master trader?")) return;
    try {
      const res = await fetch(apiUrl(`/api/user/mampam/unfollow/${id}`), { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      const json = await res.json();
      if (json.success) setSubs(s => s.filter(x => x.id !== id));
      else alert(json.error || "Failed to unfollow");
    } catch { alert("Network error"); }
  };

  if (loading) return <div className="py-20 text-center text-gray-500 text-sm">Loading subscriptions…</div>;

  if (subs.length === 0) return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
      <p className="text-gray-400 font-medium mb-1">No active subscriptions</p>
      <p className="text-gray-600 text-sm">Go to Discover to start copying a master trader</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {subs.map(s => (
        <div key={s.id} className="rounded-2xl p-5" style={{ background: "linear-gradient(160deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-sm font-bold text-violet-400">
                {(s.master_name || "M")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{s.master_name}</p>
                <p className="text-gray-500 text-xs">Since {new Date(s.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.status === "active" ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/30" : "bg-white/5 text-gray-500 border border-white/10"}`}>
              {s.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Copy Amount", value: fmt(s.copy_amount), color: "text-white" },
              { label: "Total Profit", value: fmt(s.total_profit), color: Number(s.total_profit) >= 0 ? "text-cyan-400" : "text-red-400" },
              { label: "Trades", value: String(s.trades_copied || 0), color: "text-white" },
            ].map(x => (
              <div key={x.label} className="rounded-xl px-2.5 py-2.5 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{x.label}</p>
                <p className={`text-xs font-bold ${x.color}`}>{x.value}</p>
              </div>
            ))}
          </div>

          <button onClick={() => handleUnfollow(s.id)}
            className="w-full py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/20 transition"
            style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
            Stop Copying
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Trades Tab ───────────────────────────────────────────────
function TradesTab() {
  const [trades, setTrades] = useState<CopiedTrade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl("/api/user/mampam/trades"), { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(j => { if (j.success) setTrades(j.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-gray-500 text-sm">Loading trades…</div>;

  if (trades.length === 0) return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-3xl">📊</div>
      <p className="text-gray-400 font-medium mb-1">No copied trades yet</p>
      <p className="text-gray-600 text-sm">Trades from your followed masters will appear here</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Master", "Symbol", "Side", "Volume", "Open Price", "Close Price", "P&L", "Status", "Opened"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">{t.master_name}</td>
              <td className="px-4 py-3 font-bold text-white whitespace-nowrap">{t.symbol}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${t.side === "BUY" ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
                  {t.side}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{t.volume}</td>
              <td className="px-4 py-3 font-mono text-gray-300 whitespace-nowrap">{Number(t.entry_price).toFixed(5)}</td>
              <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap">{t.close_price ? Number(t.close_price).toFixed(5) : <span className="text-gray-700">—</span>}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`font-bold ${Number(t.pnl) >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                  {Number(t.pnl) >= 0 ? "+" : ""}{fmt(t.pnl)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "OPEN" ? "bg-blue-900/50 text-blue-400 border border-blue-700/40" : "bg-white/5 text-gray-500"}`}>
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{t.opened_at ? new Date(t.opened_at).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
const TABS = ["Discover", "Subscriptions", "Trades"] as const;

export default function MampammPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Discover");
  const [showApply, setShowApply] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(apiUrl("/api/user/accounts"), { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.success) setAccounts(j.data || []); })
      .catch(() => {});
  }, []);

  return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <div className="px-4 sm:px-6 lg:px-8 py-6">

          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Copy Trading</h1>
            <p className="text-gray-500 text-sm mt-1">Discover and copy top-performing master traders</p>
          </div>

          {/* Banner */}
          <div
            className="rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: "linear-gradient(135deg,rgba(120,60,0,0.6) 0%,rgba(50,25,0,0.8) 100%)", border: "1px solid rgba(217,119,6,0.25)" }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-2xl flex-shrink-0">👑</div>
              <div>
                <p className="text-white font-bold text-base">Become a Master Trader</p>
                <p className="text-amber-700/80 text-sm mt-0.5">Share your trades and earn commission from every follower's profit</p>
              </div>
            </div>
            <button onClick={() => setShowApply(true)}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-black text-sm font-bold transition active:scale-95 whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
              <span>👑</span> Apply Now
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t ? "bg-cyan-500 text-black shadow-lg" : "text-gray-400 hover:text-white"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === "Discover"       && <DiscoverTab key={refreshKey} accounts={accounts} onRefresh={() => setRefreshKey(k => k + 1)} />}
          {tab === "Subscriptions"  && <SubscriptionsTab key={refreshKey} />}
          {tab === "Trades"         && <TradesTab />}
        </div>
      </div>

      {showApply && <ApplyModal accounts={accounts} onClose={() => setShowApply(false)} />}
    </>
  );
}
