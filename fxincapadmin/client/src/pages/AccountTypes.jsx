import React, { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
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

export const AccountTypes = () => {
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    minDeposit: 0,
    leverage: 100,
    exposureLimit: 0,
    isDemo: false,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [refreshKey, setRefreshKey] = useState(0)

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })

  const flash = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 4000)
  }

  // Fetch account types
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch('/api/admin/account-types', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        })
        if (!resp.ok) {
          const b = await resp.json().catch(() => ({}))
          throw new Error(b?.error || `Request failed: ${resp.status}`)
        }
        const json = await resp.json()
        setRows(json.data || [])
      } catch (err) {
        setError(err?.message || 'Failed to load account types')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, refreshKey])

  const openAddModal = () => {
    setEditingId(null)
    setFormData({
      name: '',
      description: '',
      minDeposit: 0,
      leverage: 100,
      exposureLimit: 0,
      isDemo: false,
    })
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (row) => {
    setEditingId(row.id)
    setFormData({
      name: row.name || '',
      description: row.description || '',
      minDeposit: Number(row.minDeposit || 0),
      leverage: Number(row.leverage || 100),
      exposureLimit: Number(row.exposureLimit || 0),
      isDemo: Boolean(row.isDemo),
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setFormError('')

    if (!formData.name.trim()) {
      setFormError('Name is required')
      return
    }

    if (formData.leverage <= 0) {
      setFormError('Leverage must be greater than 0')
      return
    }

    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/admin/account-types/${editingId}` : '/api/admin/account-types'

      const resp = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(formData),
      })

      const json = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        throw new Error(json?.error || `Request failed: ${resp.status}`)
      }

      setModalOpen(false)
      flash(editingId ? 'Account type updated successfully' : 'Account type created successfully')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setFormError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this account type?')) return

    try {
      const resp = await fetch(`/api/admin/account-types/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}))
        throw new Error(json?.error || `Request failed: ${resp.status}`)
      }

      flash('Account type deleted successfully')
      setRefreshKey(k => k + 1)
    } catch (err) {
      setActionMsg(err?.message || 'Failed to delete')
    }
  }

  const columns = useMemo(() => [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Description', accessorKey: 'description' },
    {
      header: 'Min Deposit ($)',
      accessorKey: 'minDeposit',
      cell: (value) => `$${Number(value || 0).toFixed(2)}`,
    },
    {
      header: 'Leverage',
      accessorKey: 'leverage',
      cell: (value) => `1:${value || 100}`,
    },
    {
      header: 'Exposure Limit ($)',
      accessorKey: 'exposureLimit',
      cell: (value) => {
        const limit = Number(value || 0)
        return limit === 0 ? 'Unlimited' : `$${limit.toFixed(2)}`
      },
    },
    {
      header: 'Type',
      accessorKey: 'isDemo',
      cell: (value) => (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
          value ? 'bg-amber-900/50 text-amber-300 border-amber-700' : 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
        }`}>
          {value ? 'Demo' : 'Real'}
        </span>
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: (row) => (
        <div className="flex items-center gap-0.5">
          <button
            title="Edit"
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-sky-400 transition-colors"
          >
            <MSIcon name="edit" />
          </button>
          <button
            title="Delete"
            onClick={() => handleDelete(row.id)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <MSIcon name="delete" />
          </button>
        </div>
      ),
    },
  ], [])

  return (
    <>
      <Breadcrumb items={['Groups & Accounts', 'Account Types']} />

      {actionMsg && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm text-emerald-300">
          {actionMsg}
          <button onClick={() => setActionMsg('')} className="ml-4 hover:text-white">✕</button>
        </div>
      )}

      <Card
        title="Account Types"
        footer={error ? `Error: ${error}` : loading ? 'Loading...' : `${rows.length} account type${rows.length === 1 ? '' : 's'}`}
      >
        <div className="mb-4">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <MSIcon name="add" size={18} />
            Add Account Type
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id || col.accessorKey || col.header}>
                  {col.header}
                </TableHead>
              ))}
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
              rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.id || col.accessorKey || col.header}>
                      {col.cell
                        ? typeof col.cell === 'function'
                          ? col.cell(row[col.accessorKey] ?? '', row)
                          : col.cell
                        : row[col.accessorKey] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-400 py-8">
                  {error ? `Error: ${error}` : 'No account types found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableCaption>Total: {rows.length} account types</TableCaption>
        </Table>
      </Card>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">
              {editingId ? 'Edit Account Type' : 'Add Account Type'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Name of Account</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard, Premium, VIP"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this account type"
                  rows="2"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Min Deposits ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minDeposit}
                  onChange={(e) => setFormData({ ...formData, minDeposit: Number(e.target.value) })}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Leverage (1:X)</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">1:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.leverage}
                    onChange={(e) => setFormData({ ...formData, leverage: Number(e.target.value) })}
                    placeholder="100"
                    className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Exposure Limit ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.exposureLimit}
                  onChange={(e) => setFormData({ ...formData, exposureLimit: Number(e.target.value) })}
                  placeholder="0 for unlimited"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">(0 for unlimited)</p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <button
                  onClick={() => setFormData({ ...formData, isDemo: !formData.isDemo })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isDemo ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isDemo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-300">Demo / Real Account</p>
                  <p className="text-xs text-slate-500">Enable this for practice/demo accounts</p>
                </div>
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-rose-400">{formError}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
