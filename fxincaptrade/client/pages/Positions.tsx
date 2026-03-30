import React, { useEffect, useState } from "react";
import Header from "@/components/Header";

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

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = () => {
    const token = localStorage.getItem("auth_token");
    setLoading(true);
    fetch("/api/positions/open", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => setPositions(Array.isArray(data) ? data : []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPositions(); }, []);

  const closePosition = (id: string) => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/positions/close", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ positionId: id }),
    }).then(() => fetchPositions());
  };

  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  return (
    <>
      <Header />
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Open Positions</h1>
          <div className={`text-sm font-semibold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading...</p>
        ) : positions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No open positions</p>
            <p className="text-gray-600 text-xs mt-1">Go to Markets to open a trade</p>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos) => (
              <div key={pos.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${pos.side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>{pos.side}</span>
                    <span className="text-white font-semibold">{pos.symbol}</span>
                  </div>
                  <span className={`font-bold text-lg ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}>{pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-3">
                  <div><span className="block text-gray-600">Volume</span>{pos.volume} lot</div>
                  <div><span className="block text-gray-600">Entry</span>{pos.entryPrice}</div>
                  <div>
                    <span className="block text-gray-600">TP / SL</span>
                    {pos.takeProfit ?? "—"} / {pos.stopLoss ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => closePosition(pos.id)}
                  className="w-full py-2 rounded-lg bg-red-700/30 border border-red-600/40 text-red-400 text-sm font-medium hover:bg-red-700/50 transition"
                >
                  Close Position
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
