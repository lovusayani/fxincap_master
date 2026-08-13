import React, { useEffect, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '../components/ui/table'
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

const StatusBadge = ({ v }) => {
  const cls =
    v === 'active' ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' :
    v === 'banned' ? 'bg-rose-900/50 text-rose-400 border-rose-700' :
                      'bg-slate-800 text-slate-400 border-slate-600'
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {v || '—'}
    </span>
  )
}

const ModeBadge = ({ v }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
    v === 'real' ? 'bg-sky-900/50 text-sky-300' : 'bg-amber-900/50 text-amber-300'
  }`}>
    {v}
  </span>
)

export const TraderAccountsPanel = () => {
  const { token } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionMsg, setActionMsg] = useState('')

  const [confirmModal, setConfirmModal] = useState({ open: false, id: null, action: '', label: '' })
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const [modifyModal, setModifyModal] = useState({ open: false, row: null })
  const [modifyForm, setModifyForm] = useState({ balance: 0, equity: 0, leverage: 100 })
  const [modifySaving, setModifySaving] = useState(false)
  const [modifyError, setModifyError] = useState('')

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 4000) }

  useEffect(() => {
    const ctrl = new AbortController()
    const load = async () => {
      setLoading(true); setError('')
      try {
        const params = new URLSearchParams({ limit: String(pageSize), page: String(page) })
        if (search) params.set('search', search)
        if (modeFilter) params.set('mode', modeFilter)
        if (statusFilter) params.set('status', statusFilter)

        const resp = await fetch(`/api/admin/trader-accounts?${params}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        })
        if (!resp.ok) {
          const b = await resp.json().catch(() => ({}))
          throw new Error(b?.error || `Request failed: ${resp.status}`)
        }
        const json = await resp.json()
        setRows(json.data || [])
        setTotal(Number(json.total || 0))
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Failed to load trader accounts')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => ctrl.abort()
  }, [search, modeFilter, statusFilter, page, pageSize, token, refreshKey])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const openConfirm = (row, action) => {
    const label = action === 'ban' ? 'Ban' : action === 'activate' ? 'Activate' : 'Delete'
    setConfirmModal({ open: true, id: row.id, action, label, row })
    setConfirmError('')
  }

  const handleConfirm = async () => {
    setConfirmLoading(true); setConfirmError('')
    try {
      const { id, action } = confirmModal
      const url = action === 'delete' ? `/api/admin/trader-accounts/${id}` : `/api/admin/trader-accounts/${id}/${action}`
      const method = action === 'delete' ? 'DELETE' : 'PUT'
      const resp = await fetch(url, { method, headers: authHeaders() })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Request failed: ${resp.status}`)
      flash(json.message || 'Done')
      setConfirmModal({ open: false, id: null, action: '', label: '' })
      setRefreshKey(k => k + 1)
    } catch (err) {
      setConfirmError(err?.message || 'Action failed')
    } finally {
      setConfirmLoading(false)
    }
  }

  const openModify = (row) => {
    setModifyModal({ open: true, row })
    setModifyForm({ balance: row.balance, equity: row.equity, leverage: row.leverage })
    setModifyError('')
  }

  const handleModifySave = async () => {
    setModifySaving(true); setModifyError('')
    try {
      const resp = await fetch(`/api/admin/trader-accounts/${modifyModal.row.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          balance: Number(modifyForm.balance),
          equity: Number(modifyForm.equity),
          leverage: Number(modifyForm.leverage),
        }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Request failed: ${resp.status}`)
      flash('Account updated successfully')
      setModifyModal({ open: false, row: null })
      setRefreshKey(k => k + 1)
    } catch (err) {
      setModifyError(err?.message || 'Failed to update')
    } finally {
      setModifySaving(false)
    }
  }

  const columns = useMemo(() => [
    { header: 'Trader' },
    { header: 'Account #' },
    { header: 'Type' },
    { header: 'Mode' },
    { header: 'Balance' },
    { header: 'Leverage' },
    { header: 'Active' },
    { header: 'Status' },
    { header: 'Actions' },
  ], [])

  return (
    <>
      {actionMsg && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-300">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="ml-4 hover:text-white">✕</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <MSIcon name="search" size={16} />
          </span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search trader name, email, account #…"
            className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <select
          value={modeFilter}
          onChange={e => { setModeFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Modes</option>
          <option value="real">Real</option>
          <option value="demo">Demo</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => <TableHead key={col.header}>{col.header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={columns.length} className="text-center text-slate-400 py-8">Loading…</TableCell></TableRow>
          ) : rows.length ? (
            rows.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-sm text-slate-100">{row.traderName}</div>
                  <div className="text-xs text-slate-500">{row.traderEmail}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.accountNumber}</TableCell>
                <TableCell>{row.accountTypeName}</TableCell>
                <TableCell><ModeBadge v={row.tradingMode} /></TableCell>
                <TableCell className="font-mono">${row.balance.toFixed(2)}</TableCell>
                <TableCell>1:{row.leverage}</TableCell>
                <TableCell>
                  {row.isActive
                    ? <span className="text-xs font-medium text-blue-400">Active</span>
                    : <span className="text-xs text-slate-500">—</span>}
                </TableCell>
                <TableCell><StatusBadge v={row.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <button title="Modify" onClick={() => openModify(row)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-sky-400 transition-colors"><MSIcon name="edit" /></button>
                    {row.status === 'banned' ? (
                      <button title="Activate" onClick={() => openConfirm(row, 'activate')} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"><MSIcon name="lock_open" /></button>
                    ) : (
                      <button title="Ban" onClick={() => openConfirm(row, 'ban')} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"><MSIcon name="block" /></button>
                    )}
                    <button title="Delete" onClick={() => openConfirm(row, 'delete')} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"><MSIcon name="delete" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={columns.length} className="text-center text-slate-400 py-8">{error ? `Error: ${error}` : 'No accounts found'}</TableCell></TableRow>
          )}
        </TableBody>
        <TableCaption>Total: {total} accounts</TableCaption>
      </Table>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">Page {page} of {pageCount}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
          <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
        </div>
      </div>

      {/* ── Confirm Modal (Ban / Activate / Delete) ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-slate-100">{confirmModal.label} Account</h3>
            <p className="mb-4 text-sm text-slate-400">
              {confirmModal.action === 'delete'
                ? `Delete account ${confirmModal.row?.accountNumber}? This cannot be undone.`
                : confirmModal.action === 'ban'
                ? `Ban account ${confirmModal.row?.accountNumber}? The trader will no longer be able to trade on it.`
                : `Activate account ${confirmModal.row?.accountNumber}? The trader will be able to trade on it again.`}
            </p>
            {confirmError && <p className="mb-3 text-xs text-rose-400">{confirmError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmModal({ open: false, id: null, action: '', label: '' })} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={confirmLoading}
                className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed ${confirmModal.action === 'activate' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {confirmLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modify Modal ── */}
      {modifyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-semibold text-slate-100">Modify Account</h3>
            <p className="mb-4 text-xs text-slate-400">{modifyModal.row?.accountNumber} — {modifyModal.row?.traderName}</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Balance ($)</label>
                <input type="number" step="0.01" min="0" value={modifyForm.balance} onChange={e => setModifyForm({ ...modifyForm, balance: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Equity ($)</label>
                <input type="number" step="0.01" min="0" value={modifyForm.equity} onChange={e => setModifyForm({ ...modifyForm, equity: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Leverage (1:X)</label>
                <input type="number" step="1" min="1" value={modifyForm.leverage} onChange={e => setModifyForm({ ...modifyForm, leverage: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none" />
              </div>
            </div>

            {modifyError && <p className="mt-3 text-xs text-rose-400">{modifyError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModifyModal({ open: false, row: null })} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleModifySave} disabled={modifySaving} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {modifySaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
