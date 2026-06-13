import React, { useState, useEffect, useCallback } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const MSIcon = ({ name, size = 18, color }) => (
  <span style={{ fontFamily: 'Material Symbols Outlined', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24", fontSize: size, lineHeight: 1, verticalAlign: 'middle', userSelect: 'none', color }}>{name}</span>
)

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(v) || 0)

// ─── Applications Tab ─────────────────────────────────────────
function ApplicationsTab({ token, onCountChange }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mampam/applications', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) { setApps(json.data || []); onCountChange?.(json.data?.length || 0) }
    } catch { setApps([]) } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleAction = async (id, action) => {
    setActionId(id + action)
    try {
      const res = await fetch(`/api/admin/mampam/applications/${id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) load()
      else alert(json.error || 'Action failed')
    } catch { alert('Request failed') } finally { setActionId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Master Trader Applications</h3>
        <button onClick={load} className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
          <MSIcon name="refresh" size={16} />
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Trader', 'Email', 'Strategy', 'Min Copy Amount', 'Profit Share %', 'Applied', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400">Loading applications…</td></tr>
            ) : apps.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-14 text-center">
                <div className="flex flex-col items-center gap-2">
                  <MSIcon name="assignment" size={36} color="#475569" />
                  <p className="text-slate-500 text-sm">No pending applications</p>
                  <p className="text-slate-600 text-xs">Master trader applications will appear here</p>
                </div>
              </td></tr>
            ) : apps.map(a => (
              <tr key={a.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-700/30 border border-violet-600/30 flex items-center justify-center text-xs font-bold text-violet-400 flex-shrink-0">
                      {(a.name || 'M')[0].toUpperCase()}
                    </div>
                    <span className="text-slate-100 text-xs font-medium">{a.name || '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{a.email}</td>
                <td className="px-3 py-2.5 text-slate-300 text-xs max-w-[180px] truncate">{a.strategy || '—'}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{a.min_copy_amount ? fmt(a.min_copy_amount) : '—'}</td>
                <td className="px-3 py-2.5 text-emerald-400 font-medium whitespace-nowrap">{a.profit_share ? `${a.profit_share}%` : '—'}</td>
                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button disabled={!!actionId} onClick={() => handleAction(a.id, 'approve')}
                      className="text-xs px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">Approve</button>
                    <button disabled={!!actionId} onClick={() => handleAction(a.id, 'reject')}
                      className="text-xs px-3 py-1 rounded-md bg-rose-800/60 hover:bg-rose-700 text-rose-300 hover:text-white transition-colors disabled:opacity-50">Reject</button>
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

// ─── All Masters Tab ──────────────────────────────────────────
function AllMastersTab({ token }) {
  const [masters, setMasters] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMaster, setSelectedMaster] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mampam/masters', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setMasters(json.data || [])
    } catch { setMasters([]) } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/admin/mampam/masters/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      })
      const json = await res.json()
      if (json.success) load()
      else alert(json.error || 'Failed to update status')
    } catch { alert('Request failed') }
  }

  const filtered = masters.filter(m =>
    !search ||
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">All Masters</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><MSIcon name="search" size={15} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none w-48" />
          </div>
          <button onClick={load} className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            <MSIcon name="refresh" size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Master Trader', 'Strategy', 'Followers', 'Copied Trades', 'Total P&L', 'Profit Share', 'Min Copy', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-400">Loading masters…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-14 text-center">
                <div className="flex flex-col items-center gap-2">
                  <MSIcon name="star" size={36} color="#475569" />
                  <p className="text-slate-500 text-sm">No masters found</p>
                  <p className="text-slate-600 text-xs">Approved master traders will appear here</p>
                </div>
              </td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-700/30 border border-violet-600/30 flex items-center justify-center text-xs font-bold text-violet-400 flex-shrink-0">
                      {(m.name || 'M')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-slate-100 text-xs font-medium">{m.name || '—'}</div>
                      <div className="text-slate-500 text-xs">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-300 text-xs max-w-[160px] truncate">{m.strategy || '—'}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{m.followers || 0}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{m.copied_trades || 0}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`font-bold text-xs ${Number(m.total_pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Number(m.total_pnl) >= 0 ? '+' : ''}{fmt(m.total_pnl)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-amber-400 font-medium whitespace-nowrap">{m.profit_share}%</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{fmt(m.min_copy_amount)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === 'active' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40' : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'}`}>
                    {(m.status || 'active').charAt(0).toUpperCase() + (m.status || 'active').slice(1)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleStatus(m.id, m.status)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors border ${m.status === 'active' ? 'border-amber-700/50 text-amber-400 hover:bg-amber-900/30' : 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30'}`}>
                      {m.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button onClick={() => setSelectedMaster(m)}
                      className="text-xs px-2.5 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                      <MSIcon name="visibility" size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Master Detail Modal */}
      {selectedMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedMaster(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100">Master Trader Details</h3>
              <button onClick={() => setSelectedMaster(null)} className="text-slate-500 hover:text-slate-300 transition-colors"><MSIcon name="close" size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-violet-700/30 border border-violet-600/30 flex items-center justify-center text-xl font-bold text-violet-400">
                  {(selectedMaster.name || 'M')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-slate-100 font-semibold">{selectedMaster.name}</p>
                  <p className="text-slate-400 text-xs">{selectedMaster.email}</p>
                </div>
              </div>
              {[
                ['Strategy', selectedMaster.strategy || '—'],
                ['Followers', selectedMaster.followers || 0],
                ['Copied Trades', selectedMaster.copied_trades || 0],
                ['Total P&L', <span className={Number(selectedMaster.total_pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmt(selectedMaster.total_pnl)}</span>],
                ['Profit Share', `${selectedMaster.profit_share}%`],
                ['Min Copy Amount', fmt(selectedMaster.min_copy_amount)],
                ['Status', selectedMaster.status],
                ['Joined', selectedMaster.created_at ? new Date(selectedMaster.created_at).toLocaleDateString() : '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs text-slate-200 font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Followers Tab ────────────────────────────────────────────
function FollowersTab({ token }) {
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mampam/followers', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setFollowers(json.data || [])
    } catch { setFollowers([]) } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const filtered = followers.filter(f =>
    !search ||
    (f.follower_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.master_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">All Followers</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><MSIcon name="search" size={15} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search follower or master…"
              className="rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none w-56" />
          </div>
          <button onClick={load} className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            <MSIcon name="refresh" size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              {['Follower', 'Email', 'Copying Master', 'Copy Amount', 'Total Profit', 'Trades Copied', 'Status', 'Since'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">Loading followers…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-14 text-center">
                <div className="flex flex-col items-center gap-2">
                  <MSIcon name="group" size={36} color="#475569" />
                  <p className="text-slate-500 text-sm">No followers yet</p>
                  <p className="text-slate-600 text-xs">Users who copy master traders will appear here</p>
                </div>
              </td></tr>
            ) : filtered.map(f => (
              <tr key={f.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-700/20 border border-blue-700/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                      {(f.follower_name || 'F')[0].toUpperCase()}
                    </div>
                    <span className="text-slate-100 text-xs font-medium">{f.follower_name || '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{f.email}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/40 text-violet-300 border border-violet-700/30">{f.master_name || '—'}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{fmt(f.copy_amount)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-xs font-bold ${Number(f.total_profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Number(f.total_profit) >= 0 ? '+' : ''}{fmt(f.total_profit)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{f.trades_copied || 0}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.status === 'active' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40' : 'bg-slate-700/60 text-slate-400'}`}>
                    {(f.status || 'active').charAt(0).toUpperCase() + (f.status || 'active').slice(1)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export const MamPam = () => {
  const { token } = useAuth()
  const authH = { Authorization: `Bearer ${token}` }
  const [activeTab, setActiveTab] = useState(1)
  const [appCount, setAppCount] = useState(0)
  const [stats, setStats] = useState({ masterTraders: 0, pendingMasters: 0, totalFollowers: 0, copiedTrades: 0, openTrades: 0, adminPool: 0 })

  useEffect(() => {
    fetch('/api/admin/mampam/stats', { headers: authH })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success && json?.data) setStats(s => ({ ...s, ...json.data })) })
      .catch(() => {})
  }, [token])

  const statCards = [
    {
      label: 'Master Traders',
      value: stats.masterTraders,
      sub: `${stats.pendingMasters} pending`,
      subColor: stats.pendingMasters > 0 ? 'text-amber-400' : 'text-slate-500',
      icon: 'star',
      iconColor: '#f59e0b',
      bg: 'bg-amber-900/10 border-amber-800/30',
      raw: false,
    },
    {
      label: 'Total Followers',
      value: stats.totalFollowers,
      icon: 'group',
      iconColor: '#60a5fa',
      bg: 'bg-blue-900/10 border-blue-800/30',
      raw: false,
    },
    {
      label: 'Copied Trades',
      value: stats.copiedTrades,
      sub: `${stats.openTrades} open`,
      subColor: 'text-emerald-400',
      icon: 'trending_up',
      iconColor: '#34d399',
      bg: 'bg-emerald-900/10 border-emerald-800/30',
      raw: false,
    },
    {
      label: 'Admin Pool',
      value: fmt(stats.adminPool),
      icon: 'attach_money',
      iconColor: '#a78bfa',
      bg: 'bg-violet-900/10 border-violet-800/30',
      raw: true,
    },
  ]

  const tabs = [
    { label: 'Applications', badge: appCount },
    { label: 'All Masters' },
    { label: 'Followers' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={['MAM & PAM', 'Copy Trade Management']} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
              <MSIcon name={s.icon} size={20} color={s.iconColor} />
            </div>
            <p className="text-2xl font-bold text-slate-100">{s.raw ? s.value : (s.value || 0).toLocaleString()}</p>
            {s.sub && <p className={`text-xs mt-1 ${s.subColor || 'text-slate-500'}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-slate-700">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-violet-500 text-violet-300 bg-violet-900/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              } rounded-t-md -mb-px`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-violet-600 text-white">
                  {t.badge}
                </span>
              )}
              {t.badge === 0 && t.label === 'Applications' && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">0</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 0 && <ApplicationsTab token={token} onCountChange={setAppCount} />}
        {activeTab === 1 && <AllMastersTab token={token} />}
        {activeTab === 2 && <FollowersTab token={token} />}
      </Card>
    </div>
  )
}
