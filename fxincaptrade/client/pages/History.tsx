import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";

interface TradeRecord {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  entryPrice: number;
  closePrice: number;
  pnl: number;
  closedAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(apiUrl("/api/history"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data as { history?: TradeRecord[] })?.history || [];
        setHistory(rows);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const totalPnl = history.reduce((s, t) => s + (t.pnl || 0), 0);

  return (
    <>
      <Header />
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Trade History</h1>
          {history.length > 0 && (
            <div className={`text-sm font-semibold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              Total: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No trade history yet</p>
            <p className="text-gray-600 text-xs mt-1">Closed trades will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((t) => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>{t.side}</span>
                    <span className="text-white font-semibold">{t.symbol}</span>
                    <span className="text-gray-400 text-xs">{t.volume} lot</span>
                  </div>
                  <span className={`font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex text-xs text-gray-500 gap-4">
                  <span>Entry: {t.entryPrice}</span>
                  <span>Close: {t.closePrice}</span>
                  <span>{new Date(t.closedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
