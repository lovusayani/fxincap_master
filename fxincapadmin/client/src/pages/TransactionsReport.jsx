import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { Download, RefreshCw, Search } from 'lucide-react'
import { money, fmtDateTime, statusTone, downloadCsv, defaultRange } from './reportUtils'

const SummaryTile = ({ label, value, tone = 'slate', sub }) => {
  const tones = {
    slate: 'border-slate-700 bg-slate-800/40 text-slate-300',
    emerald: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-300',
    rose: 'border-rose-600/40 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-600/40 bg-amber-500/10 text-amber-300',
  }
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

export const TransactionsReport = () => {
  const { token } = useAuth()
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, limit: '500' })
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/reports/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load report')
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [token, from, to, type, status, search])

  useEffect(() => { fetchReport() }, [token, from, to, type, status])

  const onExport = () => {
    if (!data?.rows?.length) return
    downloadCsv(`transactions-${from}-to-${to}.csv`, [
      { header: 'Date', value: (r) => fmtDateTime(r.createdAt) },
      { header: 'Trader', value: (r) => r.traderName || '' },
      { header: 'Email', value: (r) => r.traderEmail || '' },
      { header: 'Account', value: (r) => r.accountNumber || '' },
      { header: 'Type', value: (r) => r.type },
      { header: 'Method', value: (r) => r.method || '' },
      { header: 'Amount', value: (r) => r.amount.toFixed(2) },
      { header: 'Status', value: (r) => r.status },
      { header: 'Reference', value: (r) => r.reference || '' },
    ], data.rows)
  }

  const s = data?.summary

  return (
    <>
      <Breadcrumb items={['Home', 'Reports', 'Transactions']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Transactions Report</h1>
          <p className="text-[11px] text-slate-500">Deposit and withdrawal movements across all traders.</p>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
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
            <label className="mb-1 block text-[11px] text-slate-400">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
              <option value="">All types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReport()}
                placeholder="Name, email, reference"
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
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
          <SummaryTile label="Deposits In" value={money(s.deposits)} tone="emerald" sub={`${s.completedCount} completed`} />
          <SummaryTile label="Withdrawals Out" value={money(s.withdrawals)} tone="rose" />
          <SummaryTile label="Net Flow" value={money(s.net)} tone={s.net >= 0 ? 'emerald' : 'rose'} />
          <SummaryTile label="Pending" value={money(s.pendingAmount)} tone="amber" sub={`${s.pendingCount} awaiting review`} />
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading transactions...</p>
        ) : !data?.rows?.length ? (
          <p className="py-10 text-center text-sm text-slate-500">No transactions match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">Date</th>
                  <th className="px-2 py-2 text-left font-medium">Trader</th>
                  <th className="px-2 py-2 text-left font-medium">Account</th>
                  <th className="px-2 py-2 text-left font-medium">Type</th>
                  <th className="px-2 py-2 text-left font-medium">Method</th>
                  <th className="px-2 py-2 text-right font-medium">Amount</th>
                  <th className="px-2 py-2 text-center font-medium">Status</th>
                  <th className="px-2 py-2 text-left font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                    <td className="px-2 py-2 whitespace-nowrap text-[11px] text-slate-400">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-2 py-2">
                      <p className="text-slate-200">{r.traderName || '—'}</p>
                      <p className="text-[10px] text-slate-500">{r.traderEmail}</p>
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] text-slate-300">{r.accountNumber || '—'}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>{r.type}</span>
                    </td>
                    <td className="px-2 py-2 text-[11px] capitalize text-slate-400">{r.method || '—'}</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-slate-100">{money(r.amount)}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] text-slate-500">{r.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 border-t border-slate-700 pt-3 text-[11px] text-slate-500">
              Showing {data.rows.length} of {s?.totalRows ?? data.rows.length} transactions
            </p>
          </div>
        )}
      </div>
    </>
  )
}
