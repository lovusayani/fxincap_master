import React, { useState, useEffect, useCallback } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const MSIcon = ({ name, size = 18, color }) => (
  <span
    style={{
      fontFamily: 'Material Symbols Outlined',
      fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24",
      fontSize: size,
      lineHeight: 1,
      verticalAlign: 'middle',
      userSelect: 'none',
      color,
    }}
  >
    {name}
  </span>
)

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(v) || 0)

const TABS = ['Active IBs', 'Applications', 'IB Levels', 'Commissions', 'Settings']

// ────────────────────────────────────────────────────────────
// Sub-views
// ────────────────────────────────────────────────────────────

function ActiveIBsTab({ token }) {
  const [ibs, setIbs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/ib/list', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setIbs(json.data || [])
      // silently show empty state if endpoint not yet ready
    } catch {
      setIbs([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const filtered = ibs.filter(ib =>
    !search ||
    (ib.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (ib.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (ib.ib_code || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Active IB Partners</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <MSIcon name="search" size={15} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search IBs…"
              className="rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none w-52"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <MSIcon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-700 bg-rose-900/30 px-4 py-2 text-sm text-rose-400">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Name', 'Email', 'IB Code', 'Referrals', 'Commission Earned', 'Pending Commission', 'Status', 'Joined'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">Loading IBs…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MSIcon name="workspace_premium" size={36} color="#475569" />
                    <p className="text-slate-500 text-sm">No IBs found</p>
                    <p className="text-slate-600 text-xs">Approved IB partners will appear here</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(ib => (
              <tr key={ib.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-600/20 border border-amber-600/30 flex items-center justify-center text-xs text-amber-400 font-bold flex-shrink-0">
                      {(ib.name || 'I')[0].toUpperCase()}
                    </div>
                    <span className="text-slate-100 text-xs font-medium">{ib.name || '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{ib.email}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="font-mono text-xs bg-slate-800 border border-slate-700 text-amber-400 px-2 py-0.5 rounded">{ib.ib_code || '—'}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{ib.referrals || 0}</td>
                <td className="px-3 py-2.5 text-emerald-400 font-medium whitespace-nowrap">{fmt(ib.commission_earned)}</td>
                <td className="px-3 py-2.5 text-amber-400 whitespace-nowrap">{fmt(ib.commission_pending)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-700/40">Active</span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{ib.created_at ? new Date(ib.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ApplicationsTab({ token, onCountChange }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/ib/applications', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) {
        setApps(json.data || [])
        onCountChange?.(json.data?.length || 0)
      } else setError(json.error || 'Failed to load applications')
    } catch {
      setApps([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleAction = async (id, action) => {
    setActionLoading(id + action)
    try {
      const res = await fetch(`/api/admin/ib/applications/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) load()
      else alert(json.error || 'Action failed')
    } catch {
      alert('Request failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">IB Applications</h3>
        <button onClick={load} className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
          <MSIcon name="refresh" size={16} />
        </button>
      </div>
      {error && <div className="mb-3 rounded-md border border-rose-700 bg-rose-900/30 px-4 py-2 text-sm text-rose-400">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Applicant', 'Email', 'Phone', 'Experience', 'Applied', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-400">Loading applications…</td></tr>
            ) : apps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MSIcon name="assignment" size={36} color="#475569" />
                    <p className="text-slate-500 text-sm">No pending applications</p>
                  </div>
                </td>
              </tr>
            ) : apps.map(app => (
              <tr key={app.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 font-medium text-slate-100 whitespace-nowrap">{app.name || '—'}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{app.email}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{app.phone || '—'}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{app.experience || '—'}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!!actionLoading}
                      onClick={() => handleAction(app.id, 'approve')}
                      className="text-xs px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                    >Approve</button>
                    <button
                      disabled={!!actionLoading}
                      onClick={() => handleAction(app.id, 'reject')}
                      className="text-xs px-3 py-1 rounded-md bg-rose-800/60 hover:bg-rose-700 text-rose-300 hover:text-white transition-colors disabled:opacity-50"
                    >Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IBLevelsTab({ token, onCountChange }) {
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', commission_rate: '', min_referrals: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ib/levels', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) {
        setLevels(json.data || [])
        onCountChange?.(json.data?.length || 0)
      }
    } catch {
      setLevels([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.name || !form.commission_rate) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ib/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) { load(); setShowForm(false); setForm({ name: '', commission_rate: '', min_referrals: '', description: '' }) }
      else alert(json.error || 'Failed to save')
    } catch { alert('Request failed') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">IB Commission Levels</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-sm text-white transition-colors"
        >
          <MSIcon name="add" size={16} /> Add Level
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">New IB Level</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            {[
              { label: 'Level Name', key: 'name', placeholder: 'e.g. Silver' },
              { label: 'Commission Rate (%)', key: 'commission_rate', placeholder: 'e.g. 2.5', type: 'number' },
              { label: 'Min Referrals', key: 'min_referrals', placeholder: 'e.g. 5', type: 'number' },
              { label: 'Description', key: 'description', placeholder: 'Optional' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Level'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Level', 'Commission Rate', 'Min Referrals', 'Description', 'IBs on Level'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-12 text-center text-slate-400">Loading levels…</td></tr>
            ) : levels.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MSIcon name="layers" size={36} color="#475569" />
                    <p className="text-slate-500 text-sm">No IB levels configured</p>
                    <p className="text-slate-600 text-xs">Add levels to define commission tiers for your IB partners</p>
                  </div>
                </td>
              </tr>
            ) : levels.map(lvl => (
              <tr key={lvl.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 font-medium text-amber-400 whitespace-nowrap">{lvl.name}</td>
                <td className="px-3 py-2.5 text-emerald-400 font-bold whitespace-nowrap">{lvl.commission_rate}%</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{lvl.min_referrals || 0}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{lvl.description || '—'}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{lvl.ib_count || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Commission ledger across all partners - the source of truth for IB money. */
function CommissionsTab({ token }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = React.useCallback(() => {
    setLoading(true); setError('')
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    fetch(`/api/admin/ib/commissions${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setRows(json.data || []); else setError(json.error || 'Failed to load') })
      .catch(() => setError('Request failed'))
      .finally(() => setLoading(false))
  }, [token, status])

  useEffect(() => { load() }, [load])

  const fmt = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const badge = s => ({
    pending: 'bg-amber-500/15 text-amber-400',
    matured: 'bg-emerald-500/15 text-emerald-400',
    paid: 'bg-slate-500/15 text-slate-400',
  }[s] || 'bg-slate-500/15 text-slate-400')

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {['', 'pending', 'matured', 'paid'].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${status === s ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-md text-xs bg-slate-800 text-slate-400 hover:text-slate-200">Refresh</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading commissions…</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MSIcon name="payments" size={44} color="#334155" />
          <p className="text-slate-400 text-sm font-medium">No commission yet</p>
          <p className="text-slate-600 text-xs max-w-sm text-center">
            Commission is recorded when a referred client closes a trade. Share a partner&apos;s
            referral link, then close a trade on the referred account.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Partner</th>
                <th className="py-2 pr-4 font-medium">Client</th>
                <th className="py-2 pr-4 font-medium">Symbol</th>
                <th className="py-2 pr-4 font-medium text-right">Lots</th>
                <th className="py-2 pr-4 font-medium text-right">Rate</th>
                <th className="py-2 pr-4 font-medium text-right">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-800 text-slate-300">
                  <td className="py-2 pr-4 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{r.ib_name || '—'} <span className="text-slate-500">({r.ib_code || '—'})</span></td>
                  <td className="py-2 pr-4">{r.client_email || '—'}</td>
                  <td className="py-2 pr-4">{r.symbol || '—'}</td>
                  <td className="py-2 pr-4 text-right">{Number(r.volume || 0)}</td>
                  <td className="py-2 pr-4 text-right">{Number(r.rate || 0)}{r.model === 'percent_notional' ? '%' : '/lot'}</td>
                  <td className="py-2 pr-4 text-right font-medium text-slate-100">{fmt(r.amount)}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge(r.status)}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function IBSettingsTab({ token }) {
  const [settings, setSettings] = useState({ min_deposit: '', commission_delay_days: '', auto_approve: false, ib_registration_open: false, commission_model: 'per_lot', referral_base_url: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/ib/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success && json.data) setSettings(s => ({ ...s, ...json.data })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/admin/ib/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (json.success) setSaved(true)
      else alert(json.error || 'Failed to save settings')
    } catch { alert('Request failed') } finally { setSaving(false) }
  }

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading settings…</div>

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">IB Program Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Minimum Deposit for IB Eligibility (USD)</label>
          <input type="number" value={settings.min_deposit}
            onChange={e => setSettings(s => ({ ...s, min_deposit: e.target.value }))}
            placeholder="e.g. 100"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Commission Model</label>
          <select value={settings.commission_model || 'per_lot'}
            onChange={e => setSettings(s => ({ ...s, commission_model: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none">
            <option value="per_lot">Fixed amount per lot (rate = USD per lot)</option>
            <option value="percent_notional">Percent of traded notional (rate = %)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Decides how each level&apos;s Commission Rate is read when a referred client closes a trade.
            Changing this affects future commissions only.
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Referral Link Base URL</label>
          <input type="text" value={settings.referral_base_url || ''}
            onChange={e => setSettings(s => ({ ...s, referral_base_url: e.target.value }))}
            placeholder="e.g. https://trade.ncapfx.com"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
          <p className="text-xs text-slate-500 mt-1">Partner links become <code>&lt;base&gt;/register?ref=CODE</code>.</p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Commission Payout Delay (days)</label>
          <input type="number" value={settings.commission_delay_days}
            onChange={e => setSettings(s => ({ ...s, commission_delay_days: e.target.value }))}
            placeholder="e.g. 7"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div>
            <p className="text-sm text-slate-200">Auto-approve IB Applications</p>
            <p className="text-xs text-slate-500 mt-0.5">Automatically approve all incoming IB applications</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, auto_approve: !s.auto_approve }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.auto_approve ? 'bg-emerald-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.auto_approve ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div>
            <p className="text-sm text-slate-200">IB Registration Open</p>
            <p className="text-xs text-slate-500 mt-0.5">Allow users to apply for IB partnership</p>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, ib_registration_open: !s.ib_registration_open }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.ib_registration_open ? 'bg-emerald-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.ib_registration_open ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><MSIcon name="check_circle" size={14} color="#34d399" /> Saved</span>}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────

export const IBProgram = () => {
  const { token } = useAuth()
  const authH = { Authorization: `Bearer ${token}` }

  const [activeTab, setActiveTab] = useState(0)
  const [appCount, setAppCount] = useState(0)
  const [levelCount, setLevelCount] = useState(0)

  const [stats, setStats] = useState({
    totalIBs: 0,
    pendingIBs: 0,
    totalReferrals: 0,
    totalCommissions: 0,
    todayCommissions: 0,
    pendingWithdrawals: 0,
    withdrawalRequests: 0,
  })

  useEffect(() => {
    fetch('/api/admin/ib/stats', { headers: authH })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success && json?.data) setStats(s => ({ ...s, ...json.data })) })
      .catch(() => {})
  }, [token])

  const statCards = [
    {
      label: 'Total IBs',
      value: stats.totalIBs,
      sub: stats.pendingIBs > 0 ? `${stats.pendingIBs} pending` : '0 pending',
      subColor: stats.pendingIBs > 0 ? 'text-amber-400' : 'text-slate-500',
      icon: 'group',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-900/20 border-blue-800/40',
      raw: false,
    },
    {
      label: 'Total Referrals',
      value: stats.totalReferrals,
      icon: 'person_add',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-900/20 border-emerald-800/40',
      raw: false,
    },
    {
      label: 'Total Commissions',
      value: fmt(stats.totalCommissions),
      sub: `Today: ${fmt(stats.todayCommissions)}`,
      subColor: 'text-emerald-400',
      icon: 'attach_money',
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-900/20 border-violet-800/40',
      raw: true,
    },
    {
      label: 'Pending Withdrawals',
      value: fmt(stats.pendingWithdrawals),
      sub: `${stats.withdrawalRequests || 0} request${stats.withdrawalRequests !== 1 ? 's' : ''}`,
      subColor: 'text-slate-500',
      icon: 'account_balance_wallet',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-900/20 border-amber-800/40',
      raw: true,
    },
  ]

  const tabLabels = [
    { label: 'Active IBs' },
    { label: 'Applications', badge: appCount },
    { label: 'IB Levels', badge: levelCount },
    { label: 'Commissions' },
    { label: 'Settings' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={['IB Program', 'IB Management']} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
              <div className={`rounded-lg border p-1.5 ${s.iconBg}`}>
                <MSIcon name={s.icon} size={18} color={s.iconColor?.replace('text-', '')} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-100">{s.raw ? s.value : (s.value || 0).toLocaleString()}</p>
            {s.sub && <p className={`text-xs mt-1 ${s.subColor || 'text-slate-500'}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div className="flex items-center gap-0 mb-5 border-b border-slate-700 overflow-x-auto">
          {tabLabels.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 0 && <ActiveIBsTab token={token} />}
        {activeTab === 1 && <ApplicationsTab token={token} onCountChange={setAppCount} />}
        {activeTab === 2 && <IBLevelsTab token={token} onCountChange={setLevelCount} />}
        {activeTab === 3 && <CommissionsTab token={token} />}
        {activeTab === 4 && <IBSettingsTab token={token} />}
      </Card>
    </div>
  )
}
