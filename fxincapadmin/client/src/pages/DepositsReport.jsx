/** Deposits — every deposit request with the account it was credited to. */
import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const money = v =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(v) || 0)

const STATUSES = ['', 'pending', 'processing', 'completed', 'rejected']

function Pill({ status }) {
  const s = String(status || '').toLowerCase()
  const cls =
    s === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
    : s === 'rejected' || s === 'failed' ? 'bg-rose-500/15 text-rose-400'
    : 'bg-amber-500/15 text-amber-400'
  const label = s === 'pending' || s === 'processing' ? 'In process' : s.charAt(0).toUpperCase() + s.slice(1)
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

export const DepositsReport = () => {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    fetch(`/api/admin/reports/deposits?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setData(json.data); else setError(json.error || 'Failed to load') })
      .catch(() => setError('Request failed'))
      .finally(() => setLoading(false))
  }, [token, status])

  useEffect(() => { load() }, [load])

  const t = data?.totals

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: 'Transactions' }, { label: 'Deposits' }]} />
      <h1 className="text-xl font-semibold text-slate-100 mt-2 mb-5">Deposits</h1>

      <div className="grid gap-4 sm:grid-cols-3 mb-6 max-w-3xl">
        {[
          ['Total Deposited', money(t?.gross), 'text-emerald-400'],
          ['Requests', t?.count ?? 0, 'text-slate-100'],
          ['In Process', money(t?.inProcess), 'text-amber-400'],
        ].map(([label, val, cls]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-xl font-semibold mt-1 ${cls}`}>{val}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100">
          {STATUSES.map(s => <option key={s || 'all'} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}</option>)}
        </select>
        <button onClick={load} className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-300 hover:text-white">Refresh</button>
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading deposits…</div>
        ) : error ? (
          <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
        ) : !data?.rows?.length ? (
          <div className="py-14 text-center text-slate-500 text-sm">No deposits found</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                {['Date', 'Trader', 'Account', 'Method', 'Amount', 'Status', 'Ref'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-300">{r.email || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.account_number || '—'}</td>
                  <td className="px-3 py-2.5 text-xs uppercase text-slate-400">{r.method || '—'}</td>
                  <td className="px-3 py-2.5 text-emerald-400 whitespace-nowrap">{money(r.amount)}</td>
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

export default DepositsReport
