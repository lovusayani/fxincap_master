import React from "react";
import Header from "@/components/Header";

const tiers = [
  { name: "Silver", min: "0–10 clients", commission: "20%", color: "text-gray-400 border-gray-500/30 bg-gray-500/5" },
  { name: "Gold", min: "11–50 clients", commission: "30%", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" },
  { name: "Platinum", min: "51+ clients", commission: "40%", color: "text-blue-400 border-blue-500/30 bg-blue-500/5" },
];

export default function IBPage() {
  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Introducing Broker Program</h1>
          <p className="text-sm text-gray-400">Earn commissions by referring clients to FxIncap</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Your Referrals", value: "0" },
            { label: "This Month", value: "$0.00" },
            { label: "Total Earned", value: "$0.00" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
          <p className="text-xs text-gray-400 mb-2">Your Referral Link</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-black/30 rounded-lg px-3 py-2.5 text-xs text-gray-400 truncate">
              https://trade.fxincap.com/register?ref=YOUR_ID
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText("https://trade.fxincap.com/register?ref=YOUR_ID")}
              className="px-3 py-2.5 rounded-lg bg-red-700 text-white text-xs hover:bg-red-600 transition"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Commission tiers */}
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Commission Tiers</h2>
        <div className="space-y-3 mb-5">
          {tiers.map((t) => (
            <div key={t.name} className={`border rounded-xl p-4 flex items-center justify-between ${t.color}`}>
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs opacity-70">{t.min}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{t.commission}</p>
                <p className="text-xs opacity-70">commission</p>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">How It Works</h2>
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2"><span className="text-red-400 font-bold">1.</span> Share your referral link with traders</li>
            <li className="flex gap-2"><span className="text-red-400 font-bold">2.</span> They register and open a real account</li>
            <li className="flex gap-2"><span className="text-red-400 font-bold">3.</span> You earn commission on every trade they make</li>
            <li className="flex gap-2"><span className="text-red-400 font-bold">4.</span> Commissions are paid monthly to your wallet</li>
          </ol>
        </div>
      </div>
    </>
  );
}
