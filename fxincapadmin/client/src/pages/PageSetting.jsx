import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Save, FileText } from 'lucide-react'

export const PageSetting = () => {
  const { token } = useAuth()
  const [form, setForm] = useState({ title: '', content: '', published: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [touched, setTouched] = useState({})
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/page-content/about-us', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load page content')
      setForm({
        title: json.data.title || 'About Us',
        content: json.data.content || '',
        published: json.data.published !== false,
      })
      setUpdatedAt(json.data.updatedAt || null)
      setMessage(null)
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load page content' })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const change = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setTouched((prev) => ({ ...prev, [field]: true }))
    setMessage(null)
  }

  const missingTitle = !form.title.trim()
  const missingContent = !form.content.trim()

  const save = async () => {
    setTouched({ title: true, content: true })
    if (missingTitle || missingContent) {
      setMessage({ type: 'error', text: 'Title and content are both required.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/page-content/about-us', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save')
      setMessage({ type: 'success', text: json.message || 'Page content saved successfully' })
      setUpdatedAt(new Date().toISOString())
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0

  if (loading) {
    return (
      <>
        <Breadcrumb items={['Home', 'Settings', 'Page Setting']} />
        <div className="h-96 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
      </>
    )
  }

  return (
    <>
      <Breadcrumb items={['Home', 'Settings', 'Page Setting']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Page Setting</h1>
          <p className="text-[11px] text-slate-500">
            Content for static pages. Stored in the database and ready to be surfaced on the site.
          </p>
        </div>
        <button
          onClick={load}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />Reload
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${
          message.type === 'success'
            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
        }`}>{message.text}</div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
        <div className="mb-4 flex items-center gap-2.5 border-b border-slate-700 pb-3">
          <FileText className="h-4 w-4 text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100">About Us</h3>
            <p className="text-[11px] text-slate-500">
              {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'Not saved yet'}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-300">
            Page Title<span className="ml-0.5 text-rose-400">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => change('title', e.target.value)}
            placeholder="About Us"
            className={`h-9 w-full rounded-md border bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none ${
              touched.title && missingTitle ? 'border-rose-500/70' : 'border-slate-700 focus:border-amber-500'
            }`}
          />
          {touched.title && missingTitle && <p className="mt-1 text-[11px] text-rose-400">Title is required.</p>}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-300">
            Content<span className="ml-0.5 text-rose-400">*</span>
          </label>
          <textarea
            rows={16}
            value={form.content}
            onChange={(e) => change('content', e.target.value)}
            placeholder={"Tell visitors about the company — who you are, what you offer, and why traders should trust you.\n\nBlank lines separate paragraphs."}
            className={`w-full rounded-md border bg-slate-800 px-3 py-2 font-mono text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none ${
              touched.content && missingContent ? 'border-rose-500/70' : 'border-slate-700 focus:border-amber-500'
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            {touched.content && missingContent
              ? <p className="text-[11px] text-rose-400">Content is required.</p>
              : <p className="text-[11px] text-slate-500">Plain text. Blank lines separate paragraphs.</p>}
            <p className="text-[11px] text-slate-500">{wordCount} words · {form.content.length} chars</p>
          </div>
        </div>

        <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => change('published', e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
          />
          <span>
            <span className="block text-sm text-slate-100">Published</span>
            <span className="block text-[11px] text-slate-500">Uncheck to keep the content saved but hidden from the site.</span>
          </span>
        </label>

        <button
          onClick={save}
          disabled={saving || missingTitle || missingContent}
          className="flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Page Content'}
        </button>
      </div>
    </>
  )
}
