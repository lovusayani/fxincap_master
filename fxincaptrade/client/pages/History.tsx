import React, { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";
import { Search, ArrowUpDown } from "lucide-react";

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
  const [sortField, setSortField] = useState<keyof TradeRecord | null>("closedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const handleSort = (field: keyof TradeRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedHistory = useMemo(() => {
    let filtered = [...history];

    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.symbol.toLowerCase().includes(lowerSearch) ||
        t.id.toLowerCase().includes(lowerSearch)
      );
    }

    // Side filter
    if (sideFilter !== "ALL") {
      filtered = filtered.filter(t => t.side === sideFilter);
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(t => new Date(t.closedAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.closedAt) <= end);
    }

    // Sorting
    filtered.sort((a, b) => {
      if (!sortField) return 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return filtered;
  }, [history, searchTerm, sideFilter, startDate, endDate, sortField, sortOrder]);

  const totalPnl = history.reduce((s, t) => s + ((t.pnl ?? 0)), 0);
  const winCount = history.filter(t => (t.pnl ?? 0) >= 0).length;
  const lossCount = history.filter(t => (t.pnl ?? 0) < 0).length;

  return (
    <>
      <Header />
      <div className="w-full min-h-screen px-4 py-6 bg-gradient-to-b from-gray-900 to-black">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Trade History</h1>

          {/* Stats Cards - Full Width Fluid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-lg px-4 py-4 backdrop-blur-sm">
              <p className="text-xs text-gray-400 mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-white">{history.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg px-4 py-4 backdrop-blur-sm">
              <p className="text-xs text-gray-400 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {history.length > 0 ? ((winCount / history.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-4 backdrop-blur-sm">
              <p className="text-xs text-gray-400 mb-1">Wins / Losses</p>
              <p className="text-2xl font-bold">
                <span className="text-green-400">{winCount}</span>
                <span className="text-gray-500 mx-2">/</span>
                <span className="text-red-400">{lossCount}</span>
              </p>
            </div>
            <div className={`bg-gradient-to-br border rounded-lg px-4 py-4 backdrop-blur-sm ${
              totalPnl >= 0
                ? "from-green-500/10 to-green-500/5 border-green-500/20"
                : "from-red-500/10 to-red-500/5 border-red-500/20"
            }`}>
              <p className="text-xs text-gray-400 mb-1">Total P&L</p>
              <p className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-6 bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Symbol or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition"
              />
            </div>

            {/* Side Filter */}
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as "ALL" | "BUY" | "SELL")}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition cursor-pointer"
            >
              <option value="ALL" className="bg-gray-900">All Sides</option>
              <option value="BUY" className="bg-gray-900">Buy Only</option>
              <option value="SELL" className="bg-gray-900">Sell Only</option>
            </select>

            {/* Start Date */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition"
            />

            {/* End Date */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition"
            />

            {/* Order Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white font-medium transition flex items-center justify-center gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortOrder === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>

          {/* Clear Filters */}
          {(searchTerm || sideFilter !== "ALL" || startDate || endDate) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSideFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-400">
          Showing <span className="text-white font-semibold">{filteredAndSortedHistory.length}</span> of <span className="text-white font-semibold">{history.length}</span> trades
        </div>

        {/* Table Section */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading trade history...</p>
          </div>
        ) : filteredAndSortedHistory.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-gray-500 text-sm">No trades found</p>
            <p className="text-gray-600 text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("symbol")}>
                    <div className="flex items-center gap-2">
                      Symbol
                      {sortField === "symbol" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("side")}>
                    <div className="flex items-center gap-2">
                      Side
                      {sortField === "side" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("volume")}>
                    <div className="flex items-center gap-2">
                      Volume
                      {sortField === "volume" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("entryPrice")}>
                    <div className="flex items-center justify-end gap-2">
                      Entry Price
                      {sortField === "entryPrice" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("closePrice")}>
                    <div className="flex items-center justify-end gap-2">
                      Close Price
                      {sortField === "closePrice" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("pnl")}>
                    <div className="flex items-center justify-end gap-2">
                      P&L
                      {sortField === "pnl" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 cursor-pointer hover:text-white hover:bg-white/10 transition" onClick={() => handleSort("closedAt")}>
                    <div className="flex items-center justify-end gap-2">
                      Closed At
                      {sortField === "closedAt" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedHistory.map((trade) => {
                  const volume = trade.volume ?? 0;
                  const entryPrice = trade.entryPrice ?? 0;
                  const closePrice = trade.closePrice ?? 0;
                  const pnl = trade.pnl ?? 0;
                  return (
                    <tr key={trade.id} className="border-b border-white/5 hover:bg-white/10 transition">
                      <td className="px-4 py-3 text-white font-semibold">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          trade.side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{volume.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">${entryPrice.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">${closePrice.toFixed(4)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        <div>{new Date(trade.closedAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(trade.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
