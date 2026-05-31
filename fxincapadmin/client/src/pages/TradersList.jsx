import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption,
} from '../components/ui/table'
import {
  useReactTable, getCoreRowModel, flexRender,
  getPaginationRowModel, getSortedRowModel,
} from '@tanstack/react-table'
import { useAuth } from '../context/AuthContext'

const MSIcon = ({ name, size = 20 }) => (
  <span
    style={{
      fontFamily: 'Material Symbols Outlined',
      fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24",
      fontSize: size,
      lineHeight: 1,
      verticalAlign: 'middle',
      userSelect: 'none',
    }}
  >{name}</span>
)

// ── Balance popover ─────────────────────────────────────────────────────────
const BalanceCell = ({ real, demo }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-0.5 rounded px-2 py-0.5 font-mono text-sm text-emerald-300 hover:bg-slate-700 transition-colors"
        title="Click to see breakdown"
      >
        ${real.toFixed(2)}
        <MSIcon name={open ? 'expand_less' : 'expand_more'} size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Balance</div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />Real
            </span>
            <span className="font-mono text-sm text-emerald-300">${real.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />Demo
            </span>
            <span className="font-mono text-sm text-sky-300">${demo.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status pill ──────────────────────────────────────────────────────────────
const StatusBadge = ({ v }) => {
  const cls =
    v === 'active'    ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' :
    v === 'banned'    ? 'bg-rose-900/50 text-rose-400 border-rose-700' :
    v === 'suspended' ? 'bg-amber-900/50 text-amber-300 border-amber-700' :
                        'bg-slate-800 text-slate-400 border-slate-600'
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {v || '—'}
    </span>
  )
}

// ── Smart pagination ─────────────────────────────────────────────────────────
const Pager = ({ pageIndex, pageCount, onGo }) => {
  if (pageCount <= 1) return null
  const pages = []
  const delta = 2
  const left  = pageIndex - delta
  const right = pageIndex + delta

  let prev = null
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 || i === pageCount - 1 || (i >= left && i <= right)) {
      if (prev !== null && i - prev > 1) pages.push('…')
      pages.push(i)
      prev = i
    }
  }

  return (
    <div className="flex items-center gap-1">
      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`e${idx}`} className="px-1 text-slate-500 text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onGo(p)}
            className={`min-w-[32px] rounded-md px-2 py-1.5 text-sm transition-colors ${
              p === pageIndex
                ? 'bg-emerald-600 text-white font-semibold'
                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >{p + 1}</button>
        )
      )}
    </div>
  )
}

// ── Shimmer placeholder ──────────────────────────────────────────────────────
const Shimmer = () => (
  <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-5 h-[110px]">
    <div
      className="absolute inset-0 -translate-x-full"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
        animation: 'shimmer 1.4s infinite',
      }}
    />
    <style>{`@keyframes shimmer { to { transform: translateX(200%) } }`}</style>
    <div className="h-3 w-20 rounded bg-slate-700 mb-3 animate-pulse" />
    <div className="h-7 w-14 rounded bg-slate-700 animate-pulse" />
    <div className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-slate-700 animate-pulse" />
  </div>
)

// ── Stat box ─────────────────────────────────────────────────────────────────
const StatBox = ({ icon, label, count, color }) => {
  const colorMap = {
    emerald: {
      border: 'border-emerald-800/60',
      bg: 'bg-emerald-900/20',
      icon: 'text-emerald-400',
      iconBg: 'bg-emerald-900/50',
      count: 'text-emerald-300',
      glow: '0 0 20px rgba(52,211,153,0.15)',
    },
    sky: {
      border: 'border-sky-800/60',
      bg: 'bg-sky-900/20',
      icon: 'text-sky-400',
      iconBg: 'bg-sky-900/50',
      count: 'text-sky-300',
      glow: '0 0 20px rgba(56,189,248,0.15)',
    },
    slate: {
      border: 'border-slate-700',
      bg: 'bg-slate-800/40',
      icon: 'text-slate-400',
      iconBg: 'bg-slate-700/50',
      count: 'text-slate-300',
      glow: '0 0 20px rgba(148,163,184,0.1)',
    },
    rose: {
      border: 'border-rose-800/60',
      bg: 'bg-rose-900/20',
      icon: 'text-rose-400',
      iconBg: 'bg-rose-900/50',
      count: 'text-rose-300',
      glow: '0 0 20px rgba(251,113,133,0.15)',
    },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border ${c.border} ${c.bg} p-5 cursor-default`}
      style={{
        transition: 'transform 220ms ease, box-shadow 220ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = c.glow
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* subtle shimmer on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)',
          transition: 'opacity 220ms ease',
        }}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">{label}</p>
          <p className={`text-3xl font-bold tabular-nums ${c.count}`}>{count.toLocaleString()}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.iconBg} ${c.icon}`}>
          <MSIcon name={icon} size={22} />
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export const TradersList = () => {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [stats,      setStats]      = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sorting,    setSorting]    = useState([])           // [{ id, desc }]
  const [total,      setTotal]      = useState(0)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionMsg,  setActionMsg]  = useState('')

  const [pwModal,    setPwModal]    = useState({ open: false, userId: null, name: '' })
  const [pwInput,    setPwInput]    = useState('')
  const [pwSaving,   setPwSaving]   = useState(false)
  const [pwError,    setPwError]    = useState('')

  const [deductModal,  setDeductModal]  = useState({ open: false, userId: null, name: '' })
  const [deductAmount, setDeductAmount] = useState('')
  const [deductMode,   setDeductMode]   = useState('demo')
  const [deductSaving, setDeductSaving] = useState(false)
  const [deductError,  setDeductError]  = useState('')

  const [confirmModal,   setConfirmModal]   = useState({ open: false, userId: null, action: '', name: '' })
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError,   setConfirmError]   = useState('')

  const [viewDetailsModal, setViewDetailsModal] = useState({ open: false, userId: null })
  const [viewDetailsData,  setViewDetailsData]  = useState(null)
  const [viewDetailsLoading, setViewDetailsLoading] = useState(false)
  const [viewDetailsError, setViewDetailsError] = useState('')

  const [tradingAccountsModal, setTradingAccountsModal] = useState({ open: false, userId: null, name: '' })
  const [tradingAccounts, setTradingAccounts] = useState([])
  const [tradingAccountsLoading, setTradingAccountsLoading] = useState(false)
  const [loginAsLoading, setLoginAsLoading] = useState(false)

  // ── Fetch stats ───────────────────────────────────────────────────────────
  useEffect(() => {
    setStatsLoading(true)
    fetch('/api/admin/traders/stats', {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then(r => r.json()).catch(() => null)
      .then(json => { if (json?.success) setStats(json.data) })
      .finally(() => setStatsLoading(false))
  }, [token, refreshKey])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController()
    const load = async () => {
      setLoading(true); setError('')
      try {
        const params = new URLSearchParams({
          limit:  String(pagination.pageSize),
          page:   String(pagination.pageIndex + 1),
        })
        if (search)       params.set('search',  search)
        if (statusFilter) params.set('status',  statusFilter)
        if (sorting[0]) {
          params.set('sortBy',  sorting[0].id)
          params.set('sortDir', sorting[0].desc ? 'desc' : 'asc')
        }

        const resp = await fetch(`/api/admin/traders?${params}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        })
        if (!resp.ok) {
          const b = await resp.json().catch(() => ({}))
          throw new Error(b?.error || `Request failed: ${resp.status}`)
        }
        const json = await resp.json()
        setRows((json.data || []).map(item => ({
          id:          item.id,
          name:        `${item.firstName || ''} ${item.lastName || ''}`.trim() || '—',
          email:       item.email  || '—',
          phone:       item.phone  || '—',
          userId:      item.id,
          realBalance: typeof item.realBalance === 'number' ? item.realBalance : 0,
          demoBalance: typeof item.demoBalance === 'number' ? item.demoBalance : 0,
          status:      item.status || '—',
          rawStatus:   item.status,
          createdAt:   item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—',
        })))
        setTotal(Number(json.total || 0))
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Failed to load traders')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => ctrl.abort()
  }, [search, statusFilter, sorting, pagination.pageIndex, pagination.pageSize, token, refreshKey])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })

  const apiCall = async (url, method, body) => {
    const resp = await fetch(url, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || `Request failed: ${resp.status}`)
    return json
  }

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 4000) }

  const resetPage = () => setPagination(p => ({ ...p, pageIndex: 0 }))

  const handleViewDetails = (row) => {
    setViewDetailsModal({ open: true, userId: row.id })
    setViewDetailsData({
      id: row.id,
      firstName: row.name?.split(' ')[0] || '',
      lastName: row.name?.split(' ').slice(1).join(' ') || '',
      email: row.email,
      phone: row.phone,
      realBalance: row.realBalance,
      demoBalance: row.demoBalance,
      status: row.rawStatus,
      createdAt: row.createdAt,
    })
    setViewDetailsLoading(false)
    setViewDetailsError('')
  }

  const closeViewDetails = () => {
    setViewDetailsModal({ open: false, userId: null })
    setViewDetailsData(null)
    setViewDetailsError('')
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwSaving(true); setPwError('')
    try {
      await apiCall(`/api/admin/traders/${pwModal.userId}/change-password`, 'POST', { newPassword: pwInput })
      setPwModal({ open: false, userId: null, name: '' }); setPwInput('')
      flash('Password changed successfully.')
    } catch (err) { setPwError(err?.message || 'Failed') }
    finally { setPwSaving(false) }
  }

  const handleDeduct = async () => {
    setDeductSaving(true); setDeductError('')
    try {
      await apiCall(`/api/admin/traders/${deductModal.userId}/deduct-fund`, 'POST', { amount: Number(deductAmount), mode: deductMode })
      setDeductModal({ open: false, userId: null, name: '' }); setDeductAmount('')
      flash('Fund deducted successfully.'); setRefreshKey(k => k + 1)
    } catch (err) { setDeductError(err?.message || 'Failed') }
    finally { setDeductSaving(false) }
  }

  const handleConfirm = async () => {
    setConfirmLoading(true); setConfirmError('')
    try {
      const { userId, action } = confirmModal
      if (action === 'delete')     await apiCall(`/api/admin/users/${userId}`, 'DELETE')
      else if (action === 'ban')   await apiCall(`/api/admin/traders/${userId}/ban`, 'PUT')
      else if (action === 'unban') await apiCall(`/api/admin/traders/${userId}/unban`, 'PUT')
      flash(action === 'delete' ? 'Trader deleted.' : action === 'ban' ? 'Trader banned.' : 'Trader unbanned.')
      setConfirmModal({ open: false, userId: null, action: '', name: '' })
      setRefreshKey(k => k + 1)
    } catch (err) { setConfirmError(err?.message || 'Action failed') }
    finally { setConfirmLoading(false) }
  }

  const handleOpenTradingAccounts = async (userId, name) => {
    closeViewDetails()
    setTradingAccountsModal({ open: true, userId, name })
    setTradingAccountsLoading(true)
    setTradingAccounts([])
    try {
      const resp = await fetch(`/api/admin/traders/${userId}/trading-accounts`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      const json = await resp.json()
      setTradingAccounts(json.data || [])
    } catch { setTradingAccounts([]) }
    finally { setTradingAccountsLoading(false) }
  }

  const handleLoginAsUser = async (userId, name) => {
    setLoginAsLoading(true)
    try {
      const resp = await fetch(`/api/admin/traders/${userId}/login-as`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const json = await resp.json()
      if (!json.success) throw new Error(json.error || 'Failed')
      const tradeUrl = `http://localhost:3000/auto-login?token=${json.token}`
      window.open(tradeUrl, '_blank')
      flash(`Logged in as ${name}`)
      closeViewDetails()
    } catch (err) {
      flash(`Error: ${err.message}`)
    } finally {
      setLoginAsLoading(false)
    }
  }

  // ── Sort toggle (server-side) ──────────────────────────────────────────────
  const toggleSort = (colId) => {
    setSorting(prev => {
      if (!prev[0] || prev[0].id !== colId) return [{ id: colId, desc: false }]
      if (!prev[0].desc) return [{ id: colId, desc: true }]
      return []
    })
    resetPage()
  }

  const sortIndicator = (colId) => {
    if (!sorting[0] || sorting[0].id !== colId) return <MSIcon name="unfold_more" size={14} />
    return sorting[0].desc
      ? <MSIcon name="arrow_downward" size={14} />
      : <MSIcon name="arrow_upward"   size={14} />
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const sortableCols = ['name', 'email', 'status', 'createdAt', 'realBalance']

  const columns = useMemo(() => [
    { header: 'Name',     accessorKey: 'name',  sortId: 'name'        },
    { header: 'Email',    accessorKey: 'email', sortId: 'email'       },
    { header: 'Phone',    accessorKey: 'phone'                         },
    {
      header: 'User ID', accessorKey: 'userId',
      cell: info => (
        <span className="font-mono text-xs text-slate-400" title={info.getValue()}>
          {String(info.getValue()).slice(0, 8)}…
        </span>
      ),
    },
    {
      header: 'Balance', id: 'balance', sortId: 'realBalance',
      cell: info => <BalanceCell real={info.row.original.realBalance} demo={info.row.original.demoBalance} />,
    },
    {
      header: 'Status', accessorKey: 'status', sortId: 'status',
      cell: info => <StatusBadge v={info.row.original.rawStatus} />,
    },
    { header: 'Joined on', accessorKey: 'createdAt', sortId: 'createdAt' },
    {
      header: 'Actions', id: 'actions',
      cell: info => {
        const row = info.row.original
        const isBanned = row.rawStatus === 'banned'
        return (
          <div className="flex items-center gap-0.5">
            <button title="View Details"     onClick={() => handleViewDetails(row)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"><MSIcon name="visibility" /></button>
            <button title="Change Password"  onClick={() => { setPwModal({ open: true, userId: row.id, name: row.name }); setPwInput(''); setPwError('') }}  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-sky-400 transition-colors"><MSIcon name="lock_reset" /></button>
            <button title="Deduct Fund"      onClick={() => { setDeductModal({ open: true, userId: row.id, name: row.name }); setDeductAmount(''); setDeductError('') }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"><MSIcon name="money_off" /></button>
            <button title={isBanned ? 'Unban' : 'Ban'} onClick={() => setConfirmModal({ open: true, userId: row.id, action: isBanned ? 'unban' : 'ban', name: row.name })} className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${isBanned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-rose-400'}`}><MSIcon name={isBanned ? 'lock_open' : 'block'} /></button>
            <button title="Delete Trader"    onClick={() => setConfirmModal({ open: true, userId: row.id, action: 'delete', name: row.name })} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"><MSIcon name="delete" /></button>
          </div>
        )
      },
    },
  ], [navigate])

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  const table = useReactTable({
    data: rows, columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, manualSorting: true,
    pageCount,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Breadcrumb items={['Members', 'Traders']} />

      {actionMsg && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-300">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="ml-4 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Stat boxes ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statsLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} />)
        ) : (
          <>
            <StatBox icon="group"         label="Total Traders"    count={stats.total}    color="sky"     />
            <StatBox icon="check_circle"  label="Active Traders"   count={stats.active}   color="emerald" />
            <StatBox icon="remove_circle" label="Inactive Traders" count={stats.inactive} color="slate"   />
            <StatBox icon="block"         label="Banned Traders"   count={stats.banned}   color="rose"    />
          </>
        )}
      </div>

      <Card
        title="Traders"
        footer={
          error   ? `Error: ${error}` :
          loading ? 'Loading...' :
          `${total} trader${total === 1 ? '' : 's'} total · Page ${pagination.pageIndex + 1} of ${pageCount}`
        }
      >
        {/* ── Toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <MSIcon name="search" size={16} />
            </span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Search name, email, phone…"
              className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); resetPage() }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>

          {/* Clear filters */}
          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setSorting([]); resetPage() }}
              className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <MSIcon name="filter_alt_off" size={14} /> Clear
            </button>
          )}

          {/* Page size */}
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            Rows:
            <select
              value={pagination.pageSize}
              onChange={e => { setPagination({ pageIndex: 0, pageSize: Number(e.target.value) }) }}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => {
                const colId = col.sortId || col.accessorKey
                const sortable = colId && sortableCols.includes(colId)
                return (
                  <TableHead
                    key={col.id || col.accessorKey || col.header}
                    onClick={sortable ? () => toggleSort(colId) : undefined}
                    className={sortable ? 'cursor-pointer select-none hover:bg-slate-700/50' : ''}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {sortable && <span className="text-slate-500">{sortIndicator(colId)}</span>}
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-400 py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-400 py-8">
                  {error ? `Error: ${error}` : 'No traders found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableCaption>Total: {total} traders</TableCaption>
        </Table>

        {/* ── Pagination ── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {total === 0 ? 'No results' : (
              <>Showing <span className="text-slate-200">{pagination.pageIndex * pagination.pageSize + 1}</span>–<span className="text-slate-200">{Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)}</span> of <span className="text-slate-200">{total}</span></>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              title="First page"
            ><MSIcon name="first_page" size={16} /></button>

            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >← Prev</button>

            <Pager
              pageIndex={pagination.pageIndex}
              pageCount={pageCount}
              onGo={i => table.setPageIndex(i)}
            />

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >Next →</button>

            <button
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last page"
            ><MSIcon name="last_page" size={16} /></button>
          </div>
        </div>
      </Card>

      {/* ── Change Password Modal ── */}
      {pwModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-slate-100">Change Password</h3>
            <p className="mb-4 text-xs text-slate-400">{pwModal.name}</p>
            <input
              type="password" value={pwInput} onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              placeholder="New password (min 6 chars)"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {pwError && <p className="mt-2 text-xs text-rose-400">{pwError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPwModal({ open: false, userId: null, name: '' })} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleChangePassword} disabled={pwSaving || !pwInput} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {pwSaving ? 'Saving…' : 'Save Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deduct Fund Modal ── */}
      {deductModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-slate-100">Deduct Fund</h3>
            <p className="mb-4 text-xs text-slate-400">{deductModal.name}</p>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-400">Account Type</label>
              <select value={deductMode} onChange={e => setDeductMode(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
                <option value="demo">Demo</option>
                <option value="real">Real</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-400">Amount (USD)</label>
              <input type="number" min="0.01" step="0.01" value={deductAmount} onChange={e => setDeductAmount(e.target.value)} placeholder="0.00"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
            </div>
            {deductError && <p className="mt-1 text-xs text-rose-400">{deductError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeductModal({ open: false, userId: null, name: '' })} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleDeduct} disabled={deductSaving || !deductAmount || Number(deductAmount) <= 0} className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {deductSaving ? 'Deducting…' : 'Deduct'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-slate-100">
              {confirmModal.action === 'delete' ? 'Delete Trader' : confirmModal.action === 'ban' ? 'Ban Trader' : 'Unban Trader'}
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              {confirmModal.action === 'delete'
                ? `Delete "${confirmModal.name}"? This cannot be undone.`
                : confirmModal.action === 'ban'
                ? `Ban "${confirmModal.name}"? They will not be able to log in.`
                : `Unban "${confirmModal.name}"? They will regain access.`}
            </p>
            {confirmError && <p className="mb-3 text-xs text-rose-400">{confirmError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirmModal({ open: false, userId: null, action: '', name: '' }); setConfirmError('') }} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleConfirm} disabled={confirmLoading} className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed ${confirmModal.action === 'unban' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {confirmLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Details Modal ── */}
      {viewDetailsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{viewDetailsData?.firstName || '—'} {viewDetailsData?.lastName || '—'}</h3>
                <p className="text-xs text-slate-400">{viewDetailsData?.email || '—'}</p>
              </div>
              <button onClick={closeViewDetails} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">✕</button>
            </div>

            {viewDetailsLoading ? (
              <div className="text-center py-6 text-slate-400">Loading…</div>
            ) : viewDetailsError ? (
              <div className="text-center py-6 text-rose-400 text-sm">{viewDetailsError}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Full Name</p>
                    <p className="text-sm font-medium text-slate-100">{viewDetailsData?.firstName || '—'} {viewDetailsData?.lastName || '—'}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Phone</p>
                    <p className="text-sm font-medium text-slate-100">{viewDetailsData?.phone || '—'}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Joined</p>
                    <p className="text-sm font-medium text-slate-100">{viewDetailsData?.createdAt ? new Date(viewDetailsData.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    <StatusBadge v={viewDetailsData?.status} />
                  </div>
                </div>

                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Email</p>
                  <p className="text-sm font-mono text-slate-100">{viewDetailsData?.email || '—'}</p>
                </div>

                <div className="mb-4 p-3 rounded-lg border border-emerald-800/50 bg-emerald-900/20">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Main Wallet Balance</p>
                      <p className="text-2xl font-bold text-emerald-300">${(viewDetailsData?.realBalance || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button title="Add Fund" className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"><MSIcon name="add" size={18} /></button>
                      <button title="Deduct Fund" className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"><MSIcon name="remove" size={18} /></button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => { setPwModal({ open: true, userId: viewDetailsModal.userId, name: viewDetailsData?.firstName + ' ' + viewDetailsData?.lastName }); setPwInput(''); setPwError(''); closeViewDetails() }} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors"><MSIcon name="lock_reset" size={16} />Change Password</button>
                  <button onClick={() => { setDeductModal({ open: true, userId: viewDetailsModal.userId, name: viewDetailsData?.firstName + ' ' + viewDetailsData?.lastName }); setDeductAmount(''); setDeductError(''); closeViewDetails() }} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"><MSIcon name="money_off" size={16} />Deduct Fund</button>
                  <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"><MSIcon name="lock" size={16} />Block</button>
                  <button onClick={() => { setConfirmModal({ open: true, userId: viewDetailsModal.userId, action: viewDetailsData?.status === 'banned' ? 'unban' : 'ban', name: viewDetailsData?.firstName + ' ' + viewDetailsData?.lastName }); closeViewDetails() }} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors"><MSIcon name="block" size={16} />Ban</button>
                  <button onClick={() => handleOpenTradingAccounts(viewDetailsModal.userId, `${viewDetailsData?.firstName} ${viewDetailsData?.lastName}`)} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors"><MSIcon name="credit_card" size={16} />Trading Accounts</button>
                  <button onClick={() => handleLoginAsUser(viewDetailsModal.userId, `${viewDetailsData?.firstName} ${viewDetailsData?.lastName}`)} disabled={loginAsLoading} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors disabled:opacity-50"><MSIcon name="login" size={16} />{loginAsLoading ? 'Opening…' : 'Login as User'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Trading Accounts Modal ── */}
      {tradingAccountsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Trading Accounts</h3>
                <p className="text-xs text-slate-400">{tradingAccountsModal.name}</p>
              </div>
              <button onClick={() => setTradingAccountsModal({ open: false, userId: null, name: '' })} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">✕</button>
            </div>

            {tradingAccountsLoading ? (
              <div className="text-center py-8 text-slate-400">Loading accounts…</div>
            ) : tradingAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No trading accounts found</div>
            ) : (
              <div className="flex flex-col gap-3">
                {tradingAccounts.map(acc => (
                  <div key={acc.id} className={`rounded-xl border p-4 ${acc.mode === 'real' ? 'border-emerald-800/60 bg-emerald-900/20' : 'border-sky-800/60 bg-sky-900/20'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${acc.mode === 'real' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-sky-900/60 text-sky-300'}`}>
                        {acc.mode} account
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${acc.status === 'active' ? 'border-emerald-700 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                        {acc.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Account Number</p>
                        <p className="font-mono text-slate-100 text-xs">{acc.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Currency</p>
                        <p className="text-slate-100">{acc.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Balance</p>
                        <p className={`font-bold ${acc.mode === 'real' ? 'text-emerald-300' : 'text-sky-300'}`}>${acc.balance.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Equity</p>
                        <p className="text-slate-100">${acc.equity.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Free Margin</p>
                        <p className="text-slate-100">${acc.freeMargin.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Available</p>
                        <p className="text-slate-100">${acc.availableBalance.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
