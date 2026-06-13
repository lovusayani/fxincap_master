import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";

const token = () => localStorage.getItem("auth_token") || "";
const authH = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });
const fmt = (v: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(v) || 0);

type IBStatus = "none" | "pending" | "approved" | "rejected";
type IBData = {
  status: IBStatus;
  ib_code?: string;
  referrals?: number;
  commission_earned?: number;
  commission_pending?: number;
  level_name?: string;
};

// ─── Ribbon Icon SVG ──────────────────────────────────────────
function RibbonIcon({ color = "#22d3ee", size = 36 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}


// ─── State: Landing (not applied) ────────────────────────────
function IBLanding({ onApply, applying, error }: { onApply: () => void; applying: boolean; error: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
        <RibbonIcon color="#22d3ee" size={40} />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2 text-center">Become an Introducing Broker</h1>
      <p className="text-gray-400 text-sm text-center mb-8 max-w-sm leading-relaxed">
        Earn commissions by referring traders. Get up to 5 levels of referral commissions!
      </p>

      <div className="w-full max-w-md rounded-2xl px-5 py-5 mb-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-sm font-semibold text-white mb-4">Benefits:</p>
        <ul className="space-y-3">
          {[
            "Earn commission on every trade your referrals make",
            "Multi-level commissions (up to 5 levels)",
            "Real-time commission tracking",
            "Easy withdrawal to your wallet",
          ].map(b => (
            <li key={b} className="flex items-start gap-3 text-sm text-cyan-400">
              <span className="mt-0.5 flex-shrink-0 font-bold">›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

      <button
        onClick={onApply}
        disabled={applying}
        className="px-10 py-3.5 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 active:scale-95 disabled:opacity-60 transition"
      >
        {applying ? "Submitting…" : "Apply Now"}
      </button>
    </div>
  );
}

// ─── State: Pending ───────────────────────────────────────────
function IBPending() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.25)" }}>
        <RibbonIcon color="#f59e0b" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3 text-center">Application Pending</h2>
      <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">
        Your IB application is under review. You will be notified once approved.
      </p>
    </div>
  );
}

// ─── State: Rejected ─────────────────────────────────────────
function IBRejected({ onReapply }: { onReapply: () => void | Promise<void> }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <RibbonIcon color="#f87171" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3 text-center">Application Not Approved</h2>
      <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed mb-8">
        Unfortunately your IB application was not approved. You may reapply or contact support for more information.
      </p>
      <button onClick={() => onReapply()} className="px-8 py-3.5 rounded-xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition">
        Reapply
      </button>
    </div>
  );
}

// ─── State: Approved Dashboard ───────────────────────────────
function IBDashboard({ data }: { data: IBData }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin.replace("3000", "3000"); // same origin
  const referralLink = `${origin}/register?ref=${data.ib_code || ""}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(referralLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)" }}>
          <RibbonIcon color="#22d3ee" size={30} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Introducing Broker</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-700/30">Active</span>
            {data.level_name && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-900/30 text-amber-400 border border-amber-700/30">{data.level_name}</span>}
            {data.ib_code && <span className="text-xs text-gray-500 font-mono">Code: {data.ib_code}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Referrals", value: String(data.referrals || 0), color: "text-white", icon: "👥" },
          { label: "Commission Earned", value: fmt(data.commission_earned || 0), color: "text-emerald-400", icon: "💰" },
          { label: "Pending Commission", value: fmt(data.commission_pending || 0), color: "text-amber-400", icon: "⏳" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{s.icon}</span>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Referral Link</p>
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl px-4 py-3 text-sm text-gray-400 font-mono truncate" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {referralLink}
          </div>
          <button onClick={copyLink}
            className={`px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${copied ? "bg-emerald-600 text-white" : "bg-cyan-500 text-black hover:bg-cyan-400"}`}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Commission tiers */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-sm font-semibold text-white mb-4">Commission Levels</p>
        <div className="space-y-3">
          {[
            { level: "Level 1", desc: "Direct referrals", rate: "Up to 40%", color: "text-cyan-400 border-cyan-700/30 bg-cyan-900/10" },
            { level: "Level 2", desc: "Referrals of referrals", rate: "Up to 20%", color: "text-blue-400 border-blue-700/30 bg-blue-900/10" },
            { level: "Level 3–5", desc: "Deep network", rate: "Up to 10%", color: "text-violet-400 border-violet-700/30 bg-violet-900/10" },
          ].map(t => (
            <div key={t.level} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${t.color}`}>
              <div>
                <p className="text-sm font-semibold">{t.level}</p>
                <p className="text-xs opacity-60 mt-0.5">{t.desc}</p>
              </div>
              <p className="text-lg font-bold">{t.rate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-sm font-semibold text-white mb-4">How It Works</p>
        <ol className="space-y-3">
          {[
            "Share your referral link with traders",
            "They register and open a real trading account",
            "You earn commission on every trade they make",
            "Commissions are credited to your IB wallet",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
              <span className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-xs font-bold text-cyan-400 flex-shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function IBPage() {
  const [status, setStatus] = useState<IBStatus | null>(null);
  const [ibData, setIbData] = useState<IBData>({ status: "none" });
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/user/ib/status"), { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) { setStatus(json.data?.status || "none"); setIbData(json.data || { status: "none" }); }
        else setStatus("none");
      })
      .catch(() => setStatus("none"))
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async () => {
    setApplying(true); setApplyError("");
    try {
      const res = await fetch(apiUrl("/api/user/ib/apply"), { method: "POST", headers: authH(), body: JSON.stringify({}) });
      const json = await res.json();
      if (json.success) { setStatus("pending"); setIbData({ status: "pending" }); }
      else setApplyError(json.error || "Failed to submit. Please try again.");
    } catch { setApplyError("Network error. Please try again."); }
    finally { setApplying(false); }
  };

  return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-black">
        {loading ? (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-gray-600 text-sm">Loading…</div>
          </div>
        ) : status === "none" || status === null ? (
          <IBLanding onApply={handleApply} applying={applying} error={applyError} />
        ) : status === "pending" ? (
          <IBPending />
        ) : status === "rejected" ? (
          <IBRejected onReapply={handleApply} />
        ) : (
          <IBDashboard data={ibData} />
        )}
      </div>
    </>
  );
}
