/**
 * Withdrawals — every withdrawal with its method, charge and net payout.
 *
 * Fee detail is joined from `withdrawal_details`; withdrawals created before
 * the wallet flow have no such row and show "—" rather than a fabricated zero.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const money = v =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(v) || 0)

const STATUSES = ['', 'pending', 'processing', 'completed', 'rejected']
const METHODS = ['', 'usdt', 'bank']

function Pill({ status }) {
  const s = String(status || '').toLowerCase()
  const cls =
    s === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
    : s === 'rejected' || s === 'failed' ? 'bg-rose-500/15 text-rose-400'
    : 'bg-amber-500/15 text-amber-400'
  const label = s === 'pending' || s === 'processing' ? 'In process' : s.charAt(0).toUpperCase() + s.slice(1)
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

export const WithdrawalsReport = () => {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    if (method) qs.set('method', method)
    fetch(`/api/admin/reports/withdrawals?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setData(json.data); else setError(json.error || 'Failed to load') })
      .catch(() => setError('Request failed'))
      .finally(() => setLoading(false))
  }, [token, status, method])

  useEffect(() => { load() }, [load])

  const t = data?.totals

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: 'Transactions' }, { label: 'Withdrawals' }]} />
      <h1 className="text-xl font-semibold text-slate-100 mt-2 mb-5">Withdrawals</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          ['Total Requested', t?.gross, 'text-slate-100'],
          ['Charges Collected', t?.fees, 'text-emerald-400'],
          ['Net Paid Out', t?.net, 'text-slate-100'],
          ['In Process', t?.inProcess, 'text-amber-400'],
        ].map(([label, val, cls]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-xl font-semibold mt-1 ${cls}`}>{money(val)}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100">
          {STATUSES.map(s => <option key={s || 'all'} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}</option>)}
        </select>
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100">
          {METHODS.map(m => <option key={m || 'all'} value={m}>{m ? m.toUpperCase() : 'All methods'}</option>)}
        </select>
        <button onClick={load} className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 hover:text-white">Refresh</button>
      </div>

      {data?.byMethod?.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {data.byMethod.map(m => (
            <div key={m.method} className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2 text-xs">
              <span className="uppercase text-slate-400">{m.method}</span>
              <span className="ml-3 text-slate-200">{m.count} req</span>
              <span className="ml-3 text-slate-200">{money(m.gross)}</span>
              <span className="ml-3 text-emerald-400">{money(m.fees)} fees</span>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading withdrawals…</div>
        ) : error ? (
          <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
        ) : !data?.rows?.length ? (
          <div className="py-14 text-center text-slate-500 text-sm">No withdrawals found</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {['Date', 'Trader', 'Method', 'Amount', 'Charge', 'Net', 'Destination', 'Status', 'Ref'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-300">{r.email || '—'}</td>
                  <td className="px-3 py-2.5 text-xs uppercase text-slate-400">{r.method || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-100 whitespace-nowrap">{money(r.amount)}</td>
                  <td className="px-3 py-2.5 text-amber-400 whitespace-nowrap">{r.fee_amount != null ? money(r.fee_amount) : '—'}</td>
                  <td className="px-3 py-2.5 text-emerald-400 whitespace-nowrap">{r.net_amount != null ? money(r.net_amount) : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[220px] truncate">
                    {r.method === 'usdt'
                      ? `${r.usdt_network || ''} ${r.usdt_address || ''}`.trim() || '—'
                      : [r.bank_name, r.bank_account_number].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2.5"><Pill status={r.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.reference_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

export default WithdrawalsReport
