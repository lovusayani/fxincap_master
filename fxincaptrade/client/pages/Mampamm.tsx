import React from "react";
import Header from "@/components/Header";

export default function MampammPage() {
  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">MAM / PAMM</h1>
          <p className="text-sm text-gray-400">Managed Account and Percentage Allocation Management</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-3xl mb-2">🏦</p>
            <h2 className="font-semibold text-white text-sm mb-1">MAM</h2>
            <p className="text-xs text-gray-400">Multi-Account Manager — trade multiple sub-accounts from one master account</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-3xl mb-2">📊</p>
            <h2 className="font-semibold text-white text-sm mb-1">PAMM</h2>
            <p className="text-xs text-gray-400">Percentage Allocation Management — investors share profits proportionally</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-gray-300">Benefits</h2>
          {[
            { icon: "✅", text: "Professional money management by verified fund managers" },
            { icon: "📈", text: "Transparent performance reporting and trade history" },
            { icon: "🔒", text: "Funds remain in your own account — managers cannot withdraw" },
            { icon: "💰", text: "Performance-based fees only — no profit, no fee" },
            { icon: "⚡", text: "Real-time trade allocation across all sub-accounts" },
          ].map((b, i) => (
            <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <span>{b.icon}</span>
              <span className="text-sm text-gray-300">{b.text}</span>
            </div>
          ))}
        </div>

        <div className="bg-red-800/20 border border-red-700/30 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-red-300 mb-1">Coming Soon</p>
          <p className="text-xs text-gray-500">MAM/PAMM is under development. Contact support to express interest or become a fund manager.</p>
        </div>
      </div>
    </>
  );
}
