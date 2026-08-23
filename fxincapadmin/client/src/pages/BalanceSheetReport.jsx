import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Wallet, ArrowDownToLine, ArrowUpFromLine, Lock, Scale, TrendingUp, TrendingDown } from 'lucide-react'
import { money } from './reportUtils'

const Row = ({ label, value, tone = 'slate', bold, indent }) => {
  const tones = {
    slate: 'text-slate-200',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
  }
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-4' : ''} ${bold ? 'border-t border-slate-700 pt-3 mt-1' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? 'font-bold' : ''} ${tones[tone]}`}>{value}</span>
    </div>
  )
}

const Panel = ({ title, subtitle, icon: Icon, children }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
    <div className="mb-3 flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 text-amber-400" />}
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
)

export const BalanceSheetReport = () => {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reports/balance-sheet', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load balance sheet')
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err?.message || 'Failed to load balance sheet')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading && !data) {
    return (
      <>
        <Breadcrumb items={['Home', 'Reports', 'Balance Sheet']} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
          ))}
        </div>
      </>
    )
  }

  if (error && !data) {
    return (
      <>
        <Breadcrumb items={['Home', 'Reports', 'Balance Sheet']} />
        <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-6 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={fetchReport} className="mt-3 rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600">Retry</button>
        </div>
      </>
    )
  }

  const d = data
  const maxTypeBalance = Math.max(1, ...d.byAccountType.map((x) => x.balance))

  return (
    <>
      <Breadcrumb items={['Home', 'Reports', 'Balance Sheet']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Balance Sheet</h1>
          <p className="text-[11px] text-slate-500">Platform financial position — client funds, cash flow, and trading results.</p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {/* Headline tiles */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">Client Funds (Real)</span>
            <Wallet className="h-4 w-4 text-emerald-400/70" />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-50">{money(d.clientFunds.realBalance)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{d.clientFunds.realAccounts} real accounts</p>
        </div>
        <div className="rounded-lg border border-sky-600/40 bg-sky-500/10 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-sky-300">Total Deposits</span>
            <ArrowDownToLine className="h-4 w-4 text-sky-400/70" />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-50">{money(d.cashFlow.deposits)}</p>
          <p className="mt-1 text-[11px] text-slate-400">lifetime, completed</p>
        </div>
        <div className="rounded-lg border border-rose-600/40 bg-rose-500/10 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-rose-300">Total Withdrawals</span>
            <ArrowUpFromLine className="h-4 w-4 text-rose-400/70" />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-50">{money(d.cashFlow.withdrawals)}</p>
          <p className="mt-1 text-[11px] text-slate-400">lifetime, completed</p>
        </div>
        <div className={`rounded-lg border p-4 ${d.platformPosition >= 0 ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-amber-600/40 bg-amber-500/10'}`}>
          <div className="mb-1 flex items-center justify-between">
            <span className={`text-[11px] font-medium uppercase tracking-wide ${d.platformPosition >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              Platform Position
            </span>
            <Scale className={`h-4 w-4 ${d.platformPosition >= 0 ? 'text-emerald-400/70' : 'text-amber-400/70'}`} />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-50">{money(d.platformPosition)}</p>
          <p className="mt-1 text-[11px] text-slate-400">net inflow − client balances</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Client Funds" subtitle="What the platform currently holds on behalf of traders" icon={Wallet}>
          <Row label="Real account balances" value={money(d.clientFunds.realBalance)} tone="emerald" />
          <Row label="Real account equity" value={money(d.clientFunds.realEquity)} indent />
          <Row label="Margin locked in open trades" value={money(d.clientFunds.locked)} tone="amber" indent />
          <Row label="Available (free) balance" value={money(d.clientFunds.available)} indent />
          <Row label="Demo balances (not liabilities)" value={money(d.clientFunds.demoBalance)} tone="slate" />
          <Row label="Total real liability" value={money(d.clientFunds.realBalance)} tone="emerald" bold />
        </Panel>

        <Panel title="Cash Flow" subtitle="Money in and out of the platform" icon={ArrowDownToLine}>
          <Row label="Deposits received" value={money(d.cashFlow.deposits)} tone="emerald" />
          <Row label="Withdrawals paid out" value={`(${money(d.cashFlow.withdrawals)})`} tone="rose" />
          <Row label="Pending / in review" value={money(d.cashFlow.pending)} tone="amber" />
          <Row label="Net inflow" value={money(d.cashFlow.net)} tone={d.cashFlow.net >= 0 ? 'emerald' : 'rose'} bold />
        </Panel>

        <Panel title="Trading Results" subtitle="Realised outcomes on closed positions" icon={d.trading.realisedPnl >= 0 ? TrendingUp : TrendingDown}>
          <Row label="Closed trades" value={d.trading.closedTrades.toLocaleString()} />
          <Row
            label="Client realised P&L"
            value={money(d.trading.realisedPnl)}
            tone={d.trading.realisedPnl >= 0 ? 'emerald' : 'rose'}
          />
          <Row label="Commission collected" value={money(d.trading.commission)} tone="emerald" />
          <Row
            label={d.trading.realisedPnl >= 0 ? 'Net to clients' : 'Net to platform'}
            value={money(Math.abs(d.trading.realisedPnl))}
            tone={d.trading.realisedPnl >= 0 ? 'rose' : 'emerald'}
            bold
          />
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Client losses accrue to the platform and gains are paid from it, so the sign here is
            inverted relative to the trader's own P&amp;L.
          </p>
        </Panel>

        <Panel title="Breakdown by Account Type" subtitle="Real accounts only" icon={Lock}>
          {d.byAccountType.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No real accounts yet.</p>
          ) : (
            <div className="space-y-3">
              {d.byAccountType.map((t) => (
                <div key={t.accountType}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{t.accountType}</span>
                    <span className="font-mono text-slate-300">{money(t.balance)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                      style={{ width: `${(t.balance / maxTypeBalance) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {t.accounts} account{t.accounts === 1 ? '' : 's'} · {money(t.locked)} locked
                  </p>
                </div>
              ))}
              <div className="mt-3 border-t border-slate-700 pt-3">
                {d.byMode.map((m) => (
                  <div key={m.mode} className="flex items-center justify-between py-1">
                    <span className="text-xs capitalize text-slate-400">{m.mode} accounts</span>
                    <span className="font-mono text-xs text-slate-300">{m.accounts} · {money(m.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
