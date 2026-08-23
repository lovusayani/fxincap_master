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

  // 'all' keeps the existing filterable history table; 'open' is a dedicated
  // view of live positions where an admin can amend or close them.
  const [tab, setTab] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')

  // Clicking any row opens this; all per-trade actions live inside it.
  const [detail, setDetail] = useState(null)     // the clicked trade
  const [form, setForm] = useState({ volume: '', stopLoss: '', takeProfit: '' })

  // Place-order-on-behalf panel.
  const [showPlace, setShowPlace] = useState(false)
  const [traders, setTraders] = useState([])
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState({
    userId: '', symbol: 'EURUSD', side: 'BUY', volume: '0.01',
    leverage: '100', stopLoss: '', takeProfit: '',
  })

  // The Open tab always queries status=OPEN regardless of the filter dropdown,
  // which belongs to the All tab.
  const effectiveStatus = tab === 'open' ? 'OPEN' : status

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (effectiveStatus) p.set('status', effectiveStatus)
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
  }, [token, effectiveStatus, search, from, to, page])

  useEffect(() => { load() }, [load])

  // Trader list for the place-order dropdown; loaded once the panel is opened.
  const loadTraders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?page=1&limit=500', { headers: authH })
      const json = await res.json()
      if (json.success) setTraders(json.data || [])
    } catch (e) {
      setError(`Could not load traders: ${e.message}`)
    }
  }, [token])

  const openDetail = (t) => {
    setDetail(t)
    setForm({
      volume: t.volume ?? '',
      stopLoss: t.stopLoss ?? '',
      takeProfit: t.takeProfit ?? '',
    })
    setError(''); setNotice('')
  }

  const isOpenTrade = (t) => String(t?.status || '').toUpperCase() === 'OPEN'

  const runAction = async (fn) => {
    setBusyId(detail?.id); setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const saveChanges = () => runAction(async () => {
    const body = {
      stopLoss: form.stopLoss === '' ? null : form.stopLoss,
      takeProfit: form.takeProfit === '' ? null : form.takeProfit,
    }
    // Only send volume when it actually changed — it moves locked margin.
    if (String(form.volume) !== String(detail.volume)) body.volume = form.volume

    const res = await fetch(`/api/admin/trades/${detail.id}`, {
      method: 'PATCH',
      headers: { ...authH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || json?.success === false) throw new Error(json?.error || `Update failed (HTTP ${res.status})`)
    setNotice(`Updated trade #${detail.id}`)
    setDetail(null)
  })

  const closeFromModal = () => {
    if (!window.confirm(
      `Close ${detail.side} ${detail.symbol} (${fmtNum(detail.volume)} lots) for ${detail.traderEmail || 'this trader'}?\n\n` +
      `Settles at the current market price; the trader's balance moves by the realised P&L.`
    )) return
    runAction(async () => {
      const res = await fetch(`/api/admin/trades/${detail.id}/close`, {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),   // no closePrice -> server-authoritative price
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Close failed (HTTP ${res.status})`)
      setNotice(`Closed #${detail.id} ${detail.symbol} at ${fmtNum(json.closePrice)} — P&L ${fmt(json.finalPnL)}`)
      setDetail(null)
    })
  }

  /**
   * Flip BUY <-> SELL on an open trade. Margin is unaffected (it does not
   * depend on direction), but the position's P&L inverts, and any SL/TP that
   * ends up on the wrong side of entry is cleared server-side — those are
   * surfaced back as warnings so the admin knows the levels are gone.
   */
  const swapSideFromModal = () => {
    const nextSide = String(detail.side).toUpperCase() === 'BUY' ? 'SELL' : 'BUY'
    const hasLevels = detail.stopLoss != null || detail.takeProfit != null
    if (!window.confirm(
      `Swap trade #${detail.id} from ${detail.side} to ${nextSide} on ${detail.symbol}?\n\n` +
      `The position's P&L direction reverses — a losing trade becomes winning and vice versa. ` +
      `Entry price and locked margin stay the same.` +
      (hasLevels ? `\n\nAny stop loss / take profit that no longer sits on the correct side of entry will be cleared.` : '')
    )) return
    runAction(async () => {
      const res = await fetch(`/api/admin/trades/${detail.id}`, {
        method: 'PATCH',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: nextSide }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Swap failed (HTTP ${res.status})`)
      const warn = Array.isArray(json?.warnings) && json.warnings.length ? ` (${json.warnings.join('; ')})` : ''
      setNotice(`Swapped #${detail.id} to ${nextSide}${warn}`)
      setDetail(null)
    })
  }

  const deleteFromModal = () => {
    if (!window.confirm(
      `Permanently DELETE trade #${detail.id} (${detail.side} ${detail.symbol})?\n\n` +
      `This removes the record with no settlement — the trader is not paid out. ` +
      `${isOpenTrade(detail) ? 'Its locked margin will be released back to the account.\n\n' : ''}` +
      `To exit a position properly, use Close instead. This cannot be undone.`
    )) return
    runAction(async () => {
      const res = await fetch(`/api/admin/trades/${detail.id}`, { method: 'DELETE', headers: authH })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Delete failed (HTTP ${res.status})`)
      setNotice(`Deleted trade #${detail.id}`)
      setDetail(null)
    })
  }

  const placeOrder = async () => {
    if (!order.userId) { setError('Select a trader'); return }
    setPlacing(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/admin/trades', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: order.userId,
          symbol: order.symbol,
          side: order.side,
          volume: Number(order.volume),
          leverage: Number(order.leverage),
          stopLoss: order.stopLoss === '' ? null : Number(order.stopLoss),
          takeProfit: order.takeProfit === '' ? null : Number(order.takeProfit),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Order failed (HTTP ${res.status})`)
      setNotice(`Opened #${json.tradeId}: ${json.side} ${json.volume} ${json.symbol} @ ${fmtNum(json.entryPrice)}`)
      setShowPlace(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setPlacing(false)
    }
  }

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

      <Card title="Trader Trades">
        {/* Tabs */}
        <div className="mb-4 flex border-b border-slate-700">
          {[
            { key: 'all',  label: 'All Trader Trades', count: total },
            { key: 'open', label: 'Open Trades',       count: stats.openPositions },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); setEditRow(null); setNotice('') }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'text-emerald-300 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  tab === t.key ? 'bg-emerald-400/20 text-emerald-200' : 'bg-slate-700/60 text-slate-300'
                }`}>
                  {t.count > 99 ? '99+' : t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mb-3 rounded-md border border-emerald-700 bg-emerald-900/30 px-4 py-2 text-sm text-emerald-300">{notice}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><MSIcon name="search" size={15} /></span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Symbol, trader email, name…"
              className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
          </div>

          {/* Status is fixed to OPEN on the Open tab, so the picker is hidden
              there rather than offering a filter that does nothing. */}
          {tab === 'all' && (
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          )}

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

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setShowPlace(true); setError(''); setNotice(''); if (!traders.length) loadTraders() }}
              className="flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors">
              <MSIcon name="add" size={16} /> Place Order
            </button>
            <button onClick={load} className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
              <MSIcon name="refresh" size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="mb-3 rounded-md border border-rose-700 bg-rose-900/30 px-4 py-2 text-sm text-rose-400">{error}</div>}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {(tab === 'open'
                  ? ['Trader','Symbol','Side','Volume','Open Price','Current P&L','Stop Loss','Take Profit','Leverage','Open Time','Actions']
                  : ['Trader','Symbol','Side','Volume','Open Price','Close Price','Profit','Leverage','Status','Open Time','Close Time']
                ).map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">Loading trades…</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-500">
                  {tab === 'open' ? 'No open positions' : 'No trades found'}
                </td></tr>
              ) : tab === 'open' ? trades.map(t => (
                <tr key={t.id} onClick={() => openDetail(t)} title="Click to manage this trade"
                  className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
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
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`font-bold ${Number(t.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(t.profit) >= 0 ? '+' : ''}{fmt(t.profit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {t.stopLoss ? fmtNum(t.stopLoss) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                    {t.takeProfit ? fmtNum(t.takeProfit) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">1:{t.leverage}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{t.openTime ? new Date(t.openTime).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-500"><MSIcon name="chevron_right" size={18} /></td>
                </tr>
              )) : trades.map(t => (
                <tr key={t.id} onClick={() => openDetail(t)} title="Click to manage this trade"
                  className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
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

      {/* ---- Trade detail modal: every per-trade action lives here ---- */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  #{detail.id} · {detail.side} {detail.symbol}
                </h3>
                <p className="text-xs text-slate-400">{detail.traderName || '—'} · {detail.traderEmail}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['Status', detail.status?.toUpperCase()],
                  ['Open Price', fmtNum(detail.openPrice)],
                  ['Leverage', `1:${detail.leverage}`],
                  ['P&L', `${Number(detail.profit) >= 0 ? '+' : ''}${fmt(detail.profit)}`],
                  ['Open Time', detail.openTime ? new Date(detail.openTime).toLocaleString() : '—'],
                  ['Close Price', detail.closePrice ? fmtNum(detail.closePrice) : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{k}</p>
                    <p className="text-slate-200">{v}</p>
                  </div>
                ))}
              </div>

              {isOpenTrade(detail) ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Lots (volume)</label>
                      <input type="number" step="0.01" min="0.01" value={form.volume}
                        onChange={e => setForm({ ...form, volume: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Stop Loss</label>
                      <input type="number" step="any" value={form.stopLoss} placeholder="none"
                        onChange={e => setForm({ ...form, stopLoss: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Take Profit</label>
                      <input type="number" step="any" value={form.takeProfit} placeholder="none"
                        onChange={e => setForm({ ...form, takeProfit: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Changing lots re-locks margin on the trader's account. Entry price is fixed — editing it would restate P&L already accrued.
                  </p>
                </>
              ) : (
                <p className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
                  This trade is closed. Only deletion is available.
                </p>
              )}

              {error && <div className="rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-300">{error}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-700 px-5 py-4">
              {isOpenTrade(detail) && (
                <>
                  <button onClick={saveChanges} disabled={busyId === detail.id}
                    className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40">
                    {busyId === detail.id ? 'Saving…' : 'Update'}
                  </button>
                  <button onClick={closeFromModal} disabled={busyId === detail.id}
                    className="rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
                    Close Trade
                  </button>
                  <button onClick={swapSideFromModal} disabled={busyId === detail.id}
                    title={`Swap direction to ${String(detail.side).toUpperCase() === 'BUY' ? 'SELL' : 'BUY'}`}
                    className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-40">
                    Swap → {String(detail.side).toUpperCase() === 'BUY' ? 'SELL' : 'BUY'}
                  </button>
                </>
              )}
              <button onClick={deleteFromModal} disabled={busyId === detail.id}
                className="rounded-md bg-rose-800 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40">
                Delete
              </button>
              <button onClick={() => setDetail(null)} disabled={busyId === detail.id}
                className="ml-auto rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Place an order on a trader's behalf ---- */}
      {showPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPlace(false)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-100">Place Order for a Trader</h3>
              <button onClick={() => setShowPlace(false)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">✕</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Trader</label>
                <select value={order.userId} onChange={e => setOrder({ ...order, userId: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
                  <option value="">{traders.length ? 'Select a trader…' : 'Loading traders…'}</option>
                  {traders.map(u => (
                    <option key={u.id} value={u.id}>
                      {(u.firstName || u.first_name || u.name || '—')} {(u.lastName || u.last_name || '')} — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Symbol</label>
                  <select value={order.symbol} onChange={e => setOrder({ ...order, symbol: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
                    {['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','EURGBP','EURJPY','GBPJPY','XAUUSD','XAGUSD','BTCUSDT','ETHUSDT'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Side</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['BUY','SELL'].map(s => (
                      <button key={s} onClick={() => setOrder({ ...order, side: s })}
                        className={`rounded-md px-2 py-2 text-sm font-semibold transition-colors ${
                          order.side === s
                            ? (s === 'BUY' ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white')
                            : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Lots</label>
                  <input type="number" step="0.01" min="0.01" value={order.volume}
                    onChange={e => setOrder({ ...order, volume: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Leverage</label>
                  <select value={order.leverage} onChange={e => setOrder({ ...order, leverage: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
                    {[100,200,500,1000,1500,2000].map(l => <option key={l} value={l}>1:{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Stop Loss (optional)</label>
                  <input type="number" step="any" value={order.stopLoss} placeholder="none"
                    onChange={e => setOrder({ ...order, stopLoss: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Take Profit (optional)</label>
                  <input type="number" step="any" value={order.takeProfit} placeholder="none"
                    onChange={e => setOrder({ ...order, takeProfit: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Fills at the live market price and locks margin against the trader's account, exactly as if they had placed it themselves.
              </p>

              {error && <div className="rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-300">{error}</div>}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-700 px-5 py-4">
              <button onClick={placeOrder} disabled={placing || !order.userId}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40">
                {placing ? 'Placing…' : 'Place Order'}
              </button>
              <button onClick={() => setShowPlace(false)} disabled={placing}
                className="ml-auto rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
