import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { Download, RefreshCw } from 'lucide-react'
import { money, downloadCsv, defaultRange } from './reportUtils'

const SummaryTile = ({ label, value, tone = 'slate', sub }) => {
  const tones = {
    slate: 'border-slate-700 bg-slate-800/40',
    emerald: 'border-emerald-600/40 bg-emerald-500/10',
    rose: 'border-rose-600/40 bg-rose-500/10',
    sky: 'border-sky-600/40 bg-sky-500/10',
  }
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

export const TradingReport = () => {
  const { token } = useAuth()
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [groupBy, setGroupBy] = useState('symbol')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, groupBy })
      const res = await fetch(`/api/admin/reports/trading?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load trading report')
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err?.message || 'Failed to load trading report')
    } finally {
      setLoading(false)
    }
  }, [token, from, to, groupBy])

  useEffect(() => { fetchReport() }, [fetchReport])

  const onExport = () => {
    if (!data?.rows?.length) return
    downloadCsv(`trading-${groupBy}-${from}-to-${to}.csv`, [
      { header: groupBy === 'trader' ? 'Trader' : 'Symbol', value: (r) => r.label },
      { header: 'Trades', value: (r) => r.trades },
      { header: 'Volume', value: (r) => r.volume.toFixed(2) },
      { header: 'P&L', value: (r) => r.pnl.toFixed(2) },
      { header: 'Wins', value: (r) => r.wins },
      { header: 'Losses', value: (r) => r.losses },
      { header: 'Win Rate %', value: (r) => r.winRate.toFixed(1) },
      { header: 'Avg P&L', value: (r) => r.avgPnl.toFixed(2) },
      { header: 'Best', value: (r) => r.best.toFixed(2) },
      { header: 'Worst', value: (r) => r.worst.toFixed(2) },
    ], data.rows)
  }

  const s = data?.summary
  const maxTrades = Math.max(1, ...(data?.rows || []).map((r) => r.trades))

  return (
    <>
      <Breadcrumb items={['Home', 'Reports', 'Trading Report']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Trading Report</h1>
          <p className="text-[11px] text-slate-500">Closed-trade performance grouped by {groupBy}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={!data?.rows?.length}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />Export CSV
          </button>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Group By</label>
            <div className="flex overflow-hidden rounded-md border border-slate-700">
              {['symbol', 'trader'].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`h-9 flex-1 text-xs font-medium capitalize transition-colors ${
                    groupBy === g ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
      )}

      {/* Summary */}
      {s && (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryTile label="Total Trades" value={s.trades.toLocaleString()} tone="sky" sub={`${s.volume.toFixed(2)} lots`} />
          <SummaryTile label="Net P&L" value={money(s.pnl)} tone={s.pnl >= 0 ? 'emerald' : 'rose'} sub="client perspective" />
          <SummaryTile label="Win Rate" value={`${s.winRate.toFixed(1)}%`} sub={`${s.wins}W / ${s.losses}L`} />
          <SummaryTile
            label="Avg Per Trade"
            value={money(s.trades > 0 ? s.pnl / s.trades : 0)}
            tone={s.pnl >= 0 ? 'emerald' : 'rose'}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading trading data...</p>
        ) : !data?.rows?.length ? (
          <p className="py-10 text-center text-sm text-slate-500">No closed trades in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">{groupBy === 'trader' ? 'Trader' : 'Symbol'}</th>
                  <th className="px-2 py-2 text-left font-medium">Share</th>
                  <th className="px-2 py-2 text-right font-medium">Trades</th>
                  <th className="px-2 py-2 text-right font-medium">Volume</th>
                  <th className="px-2 py-2 text-right font-medium">P&amp;L</th>
                  <th className="px-2 py-2 text-right font-medium">Win Rate</th>
                  <th className="px-2 py-2 text-right font-medium">Avg</th>
                  <th className="px-2 py-2 text-right font-medium">Best</th>
                  <th className="px-2 py-2 text-right font-medium">Worst</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.label} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                    <td className="px-2 py-2 font-medium text-slate-100">{r.label}</td>
                    <td className="px-2 py-2" style={{ minWidth: 90 }}>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                          style={{ width: `${(r.trades / maxTrades) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">{r.trades}</td>
                    <td className="px-2 py-2 text-right font-mono text-slate-400">{r.volume.toFixed(2)}</td>
                    <td className={`px-2 py-2 text-right font-mono font-semibold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.pnl >= 0 ? '+' : ''}{r.pnl.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`font-mono text-xs ${r.winRate >= 50 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {r.winRate.toFixed(0)}%
                      </span>
                      <span className="ml-1 text-[10px] text-slate-600">{r.wins}/{r.trades}</span>
                    </td>
                    <td className={`px-2 py-2 text-right font-mono text-xs ${r.avgPnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                      {r.avgPnl.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-emerald-400/70">{r.best.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-rose-400/70">{r.worst.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
