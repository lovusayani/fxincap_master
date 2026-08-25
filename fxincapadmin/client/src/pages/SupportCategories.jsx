/**
 * Categories offered on the trader's support form.
 *
 * Tickets store the category by name, so disabling or deleting one here never
 * rewrites tickets already filed under it — history stays intact.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Plus, Trash2, Check, X } from 'lucide-react'

export const SupportCategories = () => {
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const authH = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/support/categories', { headers: authH() })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load categories')
      setRows(json.data || [])
      setMessage(null)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }, [token, authH])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/support/categories', {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ name: newName.trim(), sortOrder: rows.length }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add')
      setNewName('')
      setMessage({ type: 'success', text: 'Category added' })
      load()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setAdding(false)
    }
  }

  const patch = async (id, body, okText) => {
    try {
      const res = await fetch(`/api/admin/support/categories/${id}`, {
        method: 'PATCH', headers: authH(), body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update')
      if (okText) setMessage({ type: 'success', text: okText })
      setEditingId(null)
      load()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
  }

  const remove = async (row) => {
    if (!window.confirm(
      `Delete the "${row.name}" category?\n\n` +
      `Traders will no longer see it on the support form. Tickets already filed under it keep the name.`
    )) return
    try {
      const res = await fetch(`/api/admin/support/categories/${row.id}`, { method: 'DELETE', headers: authH() })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete')
      setMessage({ type: 'success', text: 'Category deleted' })
      load()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
  }

  return (
    <>
      <Breadcrumb items={['Support', 'Categories']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Support Categories</h1>
          <p className="text-[11px] text-slate-500">These appear in the Category dropdown on the trader's support form.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${
          message.type === 'success'
            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
        }`}>{message.text}</div>
      )}

      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <label className="mb-1 block text-xs text-slate-300">Add a category</label>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. Payment Issue"
            className="h-9 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={add}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />{adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No categories yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-md border border-slate-700/60 bg-slate-800/40 px-3 py-2.5">
                {editingId === r.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && patch(r.id, { name: editName }, 'Category renamed')}
                      autoFocus
                      className="h-8 flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button onClick={() => patch(r.id, { name: editName }, 'Category renamed')}
                      className="rounded p-1.5 text-emerald-400 hover:bg-slate-700" title="Save">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-700" title="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(r.id); setEditName(r.name) }}
                      className="flex-1 text-left text-sm text-slate-100 hover:text-amber-300"
                      title="Click to rename"
                    >
                      {r.name}
                    </button>
                    <button
                      onClick={() => patch(r.id, { enabled: !r.enabled })}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${r.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      title={r.enabled ? 'Visible to traders' : 'Hidden from traders'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${r.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <span className="w-14 shrink-0 text-right text-[10px] uppercase text-slate-500">
                      {r.enabled ? 'Shown' : 'Hidden'}
                    </span>
                    <button onClick={() => remove(r)} className="rounded p-1.5 text-rose-400 hover:bg-slate-700" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default SupportCategories
