import React, { useEffect, useState, useCallback } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const MSIcon = ({ name, size = 18 }) => (
  <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24", fontSize: size, lineHeight: 1, verticalAlign: 'middle', userSelect: 'none' }}>{name}</span>
)

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(v) || 0)
const fmtNum = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(Number(v) || 0)

export const TradeSetting = () => {
  const { token } = useAuth()
  const authH = { Authorization: `Bearer ${token}` }

  const [trades, setTrades]   = useState([])
  const [stats,  setStats]    = useState({ totalTrades: 0, openPositions: 0, closedTrades: 0, totalProfit: 0 })
  const [total,  setTotal]    = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [status, setStatus] = useState('')         // '' | 'OPEN' | 'CLOSED'
  const [search, setSearch] = useState('')
  const [from,   setFrom]   = useState('')
  const [to,     setTo]     = useState('')
  const [page,   setPage]   = useState(1)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) p.set('status', status)
      if (search) p.set('search', search)
      if (from)   p.set('from',   from)
      if (to)     p.set('to',     to)

      const res  = await fetch(`/api/admin/trades?${p}`, { headers: authH })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed')
      setTrades(json.data || [])
      setTotal(json.total || 0)
      setStats(json.stats || { totalTrades: 0, openPositions: 0, closedTrades: 0, totalProfit: 0 })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, status, search, from, to, page])

  useEffect(() => { load() }, [load])

  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={['Trade Master', 'Trade History']} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Trades',    value: stats.totalTrades,    icon: 'bar_chart',      color: 'text-sky-300',     bg: 'bg-sky-900/20 border-sky-800/50' },
          { label: 'Open Positions',  value: stats.openPositions,  icon: 'show_chart',     color: 'text-emerald-300', bg: 'bg-emerald-900/20 border-emerald-800/50' },
          { label: 'Closed Trades',   value: stats.closedTrades,   icon: 'task_alt',       color: 'text-slate-300',   bg: 'bg-slate-800/40 border-slate-700' },
          { label: 'Total P&L',       value: fmt(stats.totalProfit), icon: 'account_balance', color: stats.totalProfit >= 0 ? 'text-emerald-300' : 'text-rose-400', bg: 'bg-slate-800/40 border-slate-700', raw: true },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.raw ? s.value : s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Card title="All Trader Trades">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><MSIcon name="search" size={15} /></span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Symbol, trader email, name…"
              className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
          </div>

<select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>

          <div className="flex items-center gap-1 text-sm text-slate-400">
            <span>From</span>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-400">
            <span>To</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
          </div>

          {(search || status || from || to) && (
            <button onClick={() => { setSearch(''); setStatus(''); setFrom(''); setTo(''); setPage(1) }}
              className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
              <MSIcon name="filter_alt_off" size={14} /> Clear
            </button>
          )}

          <button onClick={load} className="ml-auto flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            <MSIcon name="refresh" size={16} /> Refresh
          </button>
        </div>

        {/* Error */}
        {error && <div className="mb-3 rounded-md border border-rose-700 bg-rose-900/30 px-4 py-2 text-sm text-rose-400">{error}</div>}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {['Trader','Symbol','Side','Volume','Open Price','Close Price','Profit','Leverage','Status','Open Time','Close Time'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">Loading trades…</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-500">No trades found</td></tr>
              ) : trades.map(t => (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="text-slate-100 text-xs font-medium">{t.traderName || '—'}</div>
                    <div className="text-slate-500 text-xs">{t.traderEmail}</div>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-100 whitespace-nowrap">{t.symbol}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.side === 'BUY' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'}`}>{t.side}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{fmtNum(t.volume)}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-300 whitespace-nowrap">{fmtNum(t.openPrice)}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-300 whitespace-nowrap">{t.closePrice ? fmtNum(t.closePrice) : <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`font-bold ${Number(t.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(t.profit) >= 0 ? '+' : ''}{fmt(t.profit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">1:{t.leverage}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'open' ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' : 'bg-slate-700/60 text-slate-400'}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{t.openTime ? new Date(t.openTime).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{t.closeTime ? new Date(t.closeTime).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {total === 0 ? 'No results' : <>Showing <span className="text-slate-200">{(page - 1) * limit + 1}</span>–<span className="text-slate-200">{Math.min(page * limit, total)}</span> of <span className="text-slate-200">{total}</span></>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
              <MSIcon name="first_page" size={16} />
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
            <span className="text-sm text-slate-400">Page {page} of {pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
            <button onClick={() => setPage(pageCount)} disabled={page === pageCount}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
              <MSIcon name="last_page" size={16} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
