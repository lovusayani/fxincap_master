import React from "react";
import Header from "@/components/Header";

export default function TradeMasterPage() {
  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">TradeMaster</h1>
          <p className="text-sm text-gray-400">Copy top traders and automate your trading</p>
        </div>

        {/* Feature cards */}
        <div className="space-y-4 mb-6">
          {[
            {
              icon: "📊",
              title: "Copy Trading",
              desc: "Automatically copy trades from professional traders in real time. Set your risk level and let experts trade for you.",
            },
            {
              icon: "🤖",
              title: "Expert Advisors",
              desc: "Connect algorithmic trading bots and Expert Advisors (EAs) to your account via our API integration.",
            },
            {
              icon: "📈",
              title: "Signal Providers",
              desc: "Subscribe to premium trading signals with verified track records and real-time performance statistics.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
              <div className="text-2xl">{f.icon}</div>
              <div>
                <h2 className="font-semibold text-white mb-1">{f.title}</h2>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Coming soon banner */}
        <div className="bg-red-800/20 border border-red-700/30 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-red-300 mb-1">Coming Soon</p>
          <p className="text-xs text-gray-500">TradeMaster features are under development. Contact support to join the waitlist.</p>
        </div>
      </div>
    </>
  );
}
