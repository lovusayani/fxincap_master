import React from "react";
import Header from "@/components/Header";

const strategies = [
  { name: "Scalping", description: "Short-term trades held for seconds to minutes, targeting small price movements.", risk: "High", timeframe: "M1–M5" },
  { name: "Day Trading", description: "Open and close positions within the same trading day to avoid overnight risk.", risk: "Medium", timeframe: "M15–H1" },
  { name: "Swing Trading", description: "Hold positions for days to weeks to capture medium-term market moves.", risk: "Medium", timeframe: "H4–D1" },
  { name: "Position Trading", description: "Long-term trend following, holding positions for weeks to months.", risk: "Low", timeframe: "W1–MN" },
];

const riskColors: Record<string, string> = {
  High: "text-red-400 bg-red-500/10 border-red-500/20",
  Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low: "text-green-400 bg-green-500/10 border-green-500/20",
};

export default function StrategyPage() {
  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Trading Strategies</h1>
        <p className="text-sm text-gray-400 mb-5">Learn different approaches to forex trading</p>

        <div className="space-y-4 mb-6">
          {strategies.map((s) => (
            <div key={s.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-white">{s.name}</h2>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${riskColors[s.risk]}`}>{s.risk} Risk</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">{s.timeframe}</span>
                </div>
              </div>
              <p className="text-sm text-gray-400">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Key Trading Tips</h2>
          <ul className="space-y-2 text-sm text-gray-400">
            {[
              "Always use stop-loss orders to protect your capital",
              "Never risk more than 1–2% of your account per trade",
              "Trade with the trend — the trend is your friend",
              "Keep a trading journal to track and improve your performance",
              "Avoid trading during major news events unless planned",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
