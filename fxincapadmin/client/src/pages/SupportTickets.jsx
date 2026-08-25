/**
 * Support tickets raised by traders, with the reply thread.
 *
 * Replying moves an untouched ticket to In Progress automatically; the status
 * dropdown is for closing one out or reopening it.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Search, Send, MessageSquare } from 'lucide-react'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

const STATUS_STYLE = {
  open: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  closed: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}
const label = (s) => String(s || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const when = (v) => (v ? new Date(v).toLocaleString() : '—')

export const SupportTickets = () => {
  const { token } = useAuth()
  const [tickets, setTickets] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)
  const [reply, setReply] = useState('')
  const [replyStatus, setReplyStatus] = useState('')
  const [sending, setSending] = useState(false)

  const authH = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (category) params.set('category', category)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/support/tickets?${params}`, { headers: authH() })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load tickets')
      setTickets(json.data || [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, status, category, search, authH])

  useEffect(() => { load() }, [token, status, category])

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/support/categories', { headers: authH() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data || []) })
      .catch(() => { })
  }, [token, authH])

  const openTicket = async (id) => {
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, { headers: authH() })
      const json = await res.json()
      if (json.success) { setActive(json.data); setReply(''); setReplyStatus('') }
    } catch { /* ignore */ }
  }

  const sendReply = async () => {
    if (!active || !reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${active.id}/reply`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ message: reply, status: replyStatus || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send reply')
      setActive(json.data)
      setReply('')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (next) => {
    if (!active) return
    try {
      const res = await fetch(`/api/admin/support/tickets/${active.id}`, {
        method: 'PATCH', headers: authH(), body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (json.success) { setActive(json.data); load() }
    } catch { /* ignore */ }
  }

  return (
    <>
      <Breadcrumb items={['Support', 'Tickets']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Support Tickets</h1>
          <p className="text-[11px] text-slate-500">Tickets raised by traders. Replies appear on their Support page.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Subject, ticket no, email"
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}

      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No tickets match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">Ticket</th>
                  <th className="px-2 py-2 text-left font-medium">Trader</th>
                  <th className="px-2 py-2 text-left font-medium">Category</th>
                  <th className="px-2 py-2 text-left font-medium">Subject</th>
                  <th className="px-2 py-2 text-center font-medium">Replies</th>
                  <th className="px-2 py-2 text-center font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} onClick={() => openTicket(t.id)}
                    className="cursor-pointer border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                    <td className="px-2 py-2 font-mono text-[11px] text-slate-300">{t.ticketNumber}</td>
                    <td className="px-2 py-2">
                      <p className="text-slate-200">{t.traderName || '—'}</p>
                      <p className="text-[10px] text-slate-500">{t.traderEmail}</p>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-400">{t.category || '—'}</td>
                    <td className="px-2 py-2 max-w-[240px] truncate text-slate-200">{t.subject}</td>
                    <td className="px-2 py-2 text-center text-[11px] text-slate-400">{t.replyCount ?? 0}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[t.status] || STATUS_STYLE.open}`}>
                        {label(t.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-[11px] text-slate-500">{when(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActive(null)}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-slate-700 bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-700 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-100">{active.subject}</p>
                <p className="text-[11px] text-slate-500">
                  {active.ticketNumber}{active.category ? ` · ${active.category}` : ''} · {active.traderName || active.traderEmail}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={active.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
                <button onClick={() => setActive(null)} className="text-lg leading-none text-slate-400 hover:text-white">✕</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-lg bg-slate-800/60 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                  Trader · {when(active.createdAt)}
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-200">{active.description}</p>
              </div>
              {(active.replies || []).map((r) => (
                <div key={r.id}
                  className={`rounded-lg p-3 ${r.authorType === 'admin' ? 'border border-cyan-500/20 bg-cyan-500/10' : 'bg-slate-800/60'}`}>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {r.authorType === 'admin' ? 'Support' : 'Trader'} · {when(r.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-200">{r.message}</p>
                </div>
              ))}
              {(active.replies || []).length === 0 && (
                <p className="py-2 text-center text-xs text-slate-600">No replies yet.</p>
              )}
            </div>

            <div className="border-t border-slate-700 p-4">
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply to the trader…"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value)}
                  className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Set status: In Progress</option>
                  {STATUSES.map((s) => <option key={s} value={s}>Set status: {label(s)}</option>)}
                </select>
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />{sending ? 'Sending…' : 'Send Reply'}
                </button>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                  <MessageSquare className="h-3 w-3" />{(active.replies || []).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SupportTickets
