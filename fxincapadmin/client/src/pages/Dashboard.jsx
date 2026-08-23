import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import {
  Users, Wallet, ArrowDownToLine, ArrowUpFromLine, CandlestickChart,
  Clock, RefreshCw, TrendingUp, TrendingDown, Trophy, Activity, Lock,
} from 'lucide-react'

const RANGE_OPTIONS = [7, 14, 30]
const AUTO_REFRESH_MS = 30000

const money = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const compactMoney = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Stat card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, tone = 'slate', onClick, badge }) => {
  const tones = {
    slate: 'border-slate-700 bg-slate-800/40 text-slate-300',
    emerald: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-600/40 bg-sky-500/10 text-sky-300',
    amber: 'border-amber-600/40 bg-amber-500/10 text-amber-300',
    rose: 'border-rose-600/40 bg-rose-500/10 text-rose-300',
    violet: 'border-violet-600/40 bg-violet-500/10 text-violet-300',
  }
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`relative rounded-lg border p-4 text-left transition-colors ${tones[tone]} ${
        onClick ? 'cursor-pointer hover:border-slate-500 hover:bg-slate-800/70' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="font-mono text-2xl font-semibold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
      {badge > 0 && (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Wrapper>
  )
}

// ── Grouped bar chart (deposits vs withdrawals) ─────────────────────────────
const BarChart = ({ data, height = 190 }) => {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...data.map((d) => Math.max(d.deposits, d.withdrawals)))
  const slot = data.length > 0 ? 100 / data.length : 100
  const barW = slot * 0.34

  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2="100" y1={height - height * f} y2={height - height * f}
            stroke="rgba(148,163,184,0.12)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const x = i * slot
          const dH = (d.deposits / max) * (height - 12)
          const wH = (d.withdrawals / max) * (height - 12)
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y="0" width={slot} height={height} fill={hover === i ? 'rgba(148,163,184,0.07)' : 'transparent'} />
              <rect x={x + slot * 0.14} y={height - dH} width={barW} height={dH} fill="#10b981" rx="0.6" />
              <rect x={x + slot * 0.52} y={height - wH} width={barW} height={wH} fill="#f43f5e" rx="0.6" />
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ left: `${Math.min(Math.max((hover + 0.5) * slot, 8), 82)}%`, transform: 'translateX(-50%)' }}
        >
          <p className="mb-1 font-medium text-slate-200">{dayLabel(data[hover].day)}</p>
          <p className="text-emerald-400">In: {money(data[hover].deposits)}</p>
          <p className="text-rose-400">Out: {money(data[hover].withdrawals)}</p>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{data[0] ? dayLabel(data[0].day) : ''}</span>
        <span>{data.length ? dayLabel(data[data.length - 1].day) : ''}</span>
      </div>
    </div>
  )
}

// ── Area + line chart (trade volume with P&L overlay) ───────────────────────
const ActivityChart = ({ data, height = 190 }) => {
  const [hover, setHover] = useState(null)
  const maxTrades = Math.max(1, ...data.map((d) => d.trades))
  const pnls = data.map((d) => d.pnl)
  const maxAbsPnl = Math.max(1, ...pnls.map((p) => Math.abs(p)))
  const n = data.length

  const px = (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100)
  const tradeY = (v) => height - 10 - (v / maxTrades) * (height - 26)
  const pnlY = (v) => height / 2 - (v / maxAbsPnl) * (height / 2 - 14)

  const areaPath = n
    ? `M ${px(0)} ${height} ` + data.map((d, i) => `L ${px(i)} ${tradeY(d.trades)}`).join(' ') + ` L ${px(n - 1)} ${height} Z`
    : ''
  const linePath = n ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${pnlY(d.pnl)}`).join(' ') : ''

  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="tradeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="0" x2="100" y1={height / 2} y2={height / 2}
          stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        {areaPath && <path d={areaPath} fill="url(#tradeFill)" />}
        {linePath && (
          <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="1.6"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => (
          <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={px(i) - 50 / Math.max(n, 1)} y="0" width={100 / Math.max(n, 1)} height={height}
              fill={hover === i ? 'rgba(148,163,184,0.07)' : 'transparent'} />
            {hover === i && <circle cx={px(i)} cy={tradeY(d.trades)} r="1.6" fill="#38bdf8" />}
          </g>
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ left: `${Math.min(Math.max(px(hover), 10), 84)}%`, transform: 'translateX(-50%)' }}
        >
          <p className="mb-1 font-medium text-slate-200">{dayLabel(data[hover].day)}</p>
          <p className="text-sky-400">{data[hover].trades} trades</p>
          <p className={data[hover].pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            P&amp;L: {money(data[hover].pnl)}
          </p>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{data[0] ? dayLabel(data[0].day) : ''}</span>
        <span>{n ? dayLabel(data[n - 1].day) : ''}</span>
      </div>
    </div>
  )
}

const Panel = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`rounded-lg border border-slate-700 bg-slate-800/40 p-4 ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
)

export const Dashboard = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState(14)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const firstLoad = useRef(true)

  const fetchStats = useCallback(async () => {
    if (!token) return
    if (firstLoad.current) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/dashboard-stats?days=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load dashboard')
      setStats(data.data)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard')
    } finally {
      firstLoad.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, range])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchStats, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh, fetchStats])

  const pendingTotal = useMemo(
    () => (stats ? stats.pending.deposits + stats.pending.withdrawals : 0),
    [stats]
  )

  if (loading) {
    return (
      <>
        <Breadcrumb items={['Home', 'Dashboard']} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
          <div className="h-64 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
        </div>
      </>
    )
  }

  if (error && !stats) {
    return (
      <>
        <Breadcrumb items={['Home', 'Dashboard']} />
        <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-6 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={fetchStats} className="mt-3 rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600">
            Retry
          </button>
        </div>
      </>
    )
  }

  const s = stats

  return (
    <>
      <Breadcrumb items={['Home', 'Dashboard']} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Overview</h1>
          <p className="text-[11px] text-slate-500">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            {autoRefresh && <span className="ml-2 text-emerald-400">● Live</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-700">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              autoRefresh
                ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          </button>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Showing last loaded data — {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Users} tone="sky" label="Traders" value={s.traders.total}
          sub={`${s.traders.active} active · ${s.traders.new30d} new (30d)`}
          onClick={() => navigate('/members/traders')}
        />
        <StatCard
          icon={Wallet} tone="emerald" label="Real Balance" value={compactMoney(s.accounts.realBalance)}
          sub={`${s.accounts.real} real · ${s.accounts.demo} demo accounts`}
          onClick={() => navigate('/wallet')}
        />
        <StatCard
          icon={ArrowDownToLine} tone="emerald" label="Deposits" value={compactMoney(s.funds.depositTotal)}
          sub={`${s.funds.depositCount} completed`}
        />
        <StatCard
          icon={ArrowUpFromLine} tone="rose" label="Withdrawals" value={compactMoney(s.funds.withdrawalTotal)}
          sub={`${s.funds.withdrawalCount} completed`}
        />
        <StatCard
          icon={CandlestickChart} tone="violet" label="Trades" value={s.trades.closed + s.trades.open}
          sub={`${s.trades.open} open · ${s.trades.closed} closed`}
        />
        <StatCard
          icon={Clock} tone="amber" label="Pending" value={pendingTotal}
          sub={pendingTotal > 0 ? `${money(s.pending.depositAmount + s.pending.withdrawalAmount)} awaiting` : 'Nothing to review'}
          badge={pendingTotal}
          onClick={() => navigate('/all-pendings')}
        />
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Deposits vs Withdrawals"
          subtitle={`Completed transactions · last ${range} days`}
          right={
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />In
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-sm bg-rose-500" />Out
              </span>
            </div>
          }
        >
          <BarChart data={s.series.funds} />
          <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
            <span className="text-[11px] text-slate-500">Net flow (all time)</span>
            <span className={`flex items-center gap-1 font-mono text-sm font-semibold ${s.funds.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {s.funds.netFlow >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {money(s.funds.netFlow)}
            </span>
          </div>
        </Panel>

        <Panel
          title="Trading Activity"
          subtitle={`Trade count and daily P&L · last ${range} days`}
          right={
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-sm bg-sky-400" />Trades
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-sm bg-amber-500" />P&amp;L
              </span>
            </div>
          }
        >
          <ActivityChart data={s.series.trades} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700 pt-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Win Rate</p>
              <p className="font-mono text-sm font-semibold text-slate-100">{s.trades.winRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Wins</p>
              <p className="font-mono text-sm font-semibold text-emerald-400">{s.trades.wins}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Losses</p>
              <p className="font-mono text-sm font-semibold text-rose-400">{s.trades.totalHistory - s.trades.wins}</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Latest trades + side panels */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Latest Trades"
          subtitle="Most recently closed positions across all traders"
          className="xl:col-span-2"
          right={
            <button onClick={fetchStats} className="text-[11px] text-amber-400 hover:text-amber-300">
              Refresh
            </button>
          }
        >
          {s.latestTrades.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No closed trades yet.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 text-left font-medium">Trader</th>
                    <th className="px-2 py-2 text-left font-medium">Symbol</th>
                    <th className="px-2 py-2 text-left font-medium">Side</th>
                    <th className="px-2 py-2 text-right font-medium">Volume</th>
                    <th className="px-2 py-2 text-right font-medium">P&amp;L</th>
                    <th className="px-2 py-2 text-right font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {s.latestTrades.map((t) => {
                    const closed = t.closeTime ? new Date(t.closeTime) : null
                    const validClose = closed && !Number.isNaN(closed.getTime())
                    return (
                      <tr key={t.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                        <td className="px-2 py-2">
                          <p className="truncate text-slate-200">{t.traderName || '—'}</p>
                          <p className="truncate text-[10px] text-slate-500">{t.accountNumber || t.traderEmail || ''}</p>
                        </td>
                        <td className="px-2 py-2 font-medium text-slate-100">{t.symbol}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-300">{t.volume.toFixed(2)}</td>
                        <td className={`px-2 py-2 text-right font-mono font-semibold ${t.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-[11px] text-slate-500">
                          {validClose ? closed.toLocaleDateString() : '—'}
                          <span className="block text-[10px]">
                            {validClose ? closed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Top Symbols" subtitle="Ranked by trade count">
            {s.topSymbols.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {s.topSymbols.map((sym) => {
                  const max = Math.max(...s.topSymbols.map((x) => x.trades), 1)
                  const winPct = sym.trades > 0 ? (sym.wins / sym.trades) * 100 : 0
                  return (
                    <div key={sym.symbol}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">{sym.symbol}</span>
                        <span className="font-mono text-slate-400">
                          {sym.trades} · <span className={sym.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money(sym.pnl)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                          style={{ width: `${(sym.trades / max) * 100}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">{winPct.toFixed(0)}% win rate</p>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>

          <Panel title="Quick Actions" subtitle="Jump to what needs attention">
            <div className="space-y-2">
              <button
                onClick={() => navigate('/all-pendings')}
                className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-left hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-xs text-slate-200">
                  <Clock className="h-4 w-4 text-amber-400" />Pending Approvals
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  pendingTotal > 0 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>{pendingTotal}</span>
              </button>
              <button
                onClick={() => navigate('/members/traders')}
                className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-left hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-xs text-slate-200">
                  <Users className="h-4 w-4 text-sky-400" />Manage Traders
                </span>
                <span className="text-[10px] text-slate-500">{s.traders.total}</span>
              </button>
              <button
                onClick={() => navigate('/user-kyc')}
                className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-left hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-xs text-slate-200">
                  <Trophy className="h-4 w-4 text-violet-400" />KYC Review
                </span>
                <span className="text-[10px] text-slate-500">{s.traders.verified} verified</span>
              </button>
              <button
                onClick={() => navigate('/server-settings')}
                className="flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-left hover:bg-slate-700"
              >
                <span className="flex items-center gap-2 text-xs text-slate-200">
                  <Activity className="h-4 w-4 text-emerald-400" />Server Settings
                </span>
              </button>
            </div>
          </Panel>

          <Panel title="Capital At Risk" subtitle="Margin currently locked in open trades">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <Lock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-slate-100">{money(s.trades.marginLocked)}</p>
                <p className="text-[11px] text-slate-500">across {s.trades.open} open trade{s.trades.open === 1 ? '' : 's'}</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
