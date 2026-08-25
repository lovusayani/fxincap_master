/**
 * Withdrawal charges — per-method fee rules applied when a trader withdraws.
 *
 * Fees are priced server-side; this screen only edits the rules. A rule that
 * would consume the whole withdrawal is rejected by the API at quote time.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const METHOD_LABEL = { usdt: 'USDT (Crypto)', bank: 'Bank Account' }

const inputCls =
  'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none'

function RuleCard({ rule, token, onSaved }) {
  const [form, setForm] = useState(rule)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setForm(rule) }, [rule])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`/api/admin/withdrawal-fees/${rule.method}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) { setSaved(true); onSaved?.(json.data) }
      else setError(json.error || 'Failed to save')
    } catch { setError('Request failed') } finally { setSaving(false) }
  }

  const example = (() => {
    const amt = 1000
    if (!form.enabled) return 'Disabled'
    let fee = form.fee_type === 'fixed' ? Number(form.fee_value || 0) : (amt * Number(form.fee_value || 0)) / 100
    if (Number(form.min_fee) > 0) fee = Math.max(fee, Number(form.min_fee))
    if (form.max_fee !== null && form.max_fee !== '' && form.max_fee !== undefined) fee = Math.min(fee, Number(form.max_fee))
    fee = Math.round(fee * 100) / 100
    return `On a $1,000 withdrawal: charge $${fee.toFixed(2)}, trader receives $${(amt - fee).toFixed(2)}`
  })()

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{METHOD_LABEL[rule.method] || rule.method}</h3>
        <button
          onClick={() => set('enabled', !form.enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Charge Type</label>
          <select value={form.fee_type} onChange={e => set('fee_type', e.target.value)} className={inputCls}>
            <option value="percent">Percent of amount</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {form.fee_type === 'fixed' ? 'Charge (USD)' : 'Charge (%)'}
          </label>
          <input type="number" step="0.01" min="0" value={form.fee_value ?? ''} onChange={e => set('fee_value', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Minimum Charge (USD)</label>
          <input type="number" step="0.01" min="0" value={form.min_fee ?? ''} onChange={e => set('min_fee', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Maximum Charge (USD)</label>
          <input type="number" step="0.01" min="0" value={form.max_fee ?? ''} onChange={e => set('max_fee', e.target.value)} placeholder="No cap" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Min Withdrawal (USD)</label>
          <input type="number" step="0.01" min="0" value={form.min_amount ?? ''} onChange={e => set('min_amount', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Max Withdrawal (USD)</label>
          <input type="number" step="0.01" min="0" value={form.max_amount ?? ''} onChange={e => set('max_amount', e.target.value)} placeholder="No limit" className={inputCls} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{example}</p>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-5 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </Card>
  )
}

export const WithdrawalCharges = () => {
  const { token } = useAuth()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/withdrawal-fees', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setRules(json.data || []); else setError(json.error || 'Failed to load') })
      .catch(() => setError('Request failed'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6">
      <Breadcrumb items={['Transactions', 'Withdrawal Charges']} />
      <h1 className="text-xl font-semibold text-slate-100 mt-2 mb-1">Withdrawal Charges</h1>
      <p className="text-sm text-slate-500 mb-6">
        Charges are deducted from the amount the trader withdraws. Each method can be priced and limited separately.
      </p>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading charges…</div>
      ) : error ? (
        <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 max-w-4xl">
          {rules.map(r => <RuleCard key={r.method} rule={r} token={token} onSaved={load} />)}
        </div>
      )}
    </div>
  )
}

export default WithdrawalCharges
