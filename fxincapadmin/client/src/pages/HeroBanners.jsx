import React, { useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'

/**
 * Manage the promotional hero banners shown on the trader dashboard.
 *
 * Images are uploaded to /uploads/offers/ and read back by the trading client
 * through the public GET /api/offers.
 */
export const HeroBanners = () => {
  const { token } = useAuth()
  const authH = { Authorization: `Bearer ${token}` }

  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({ file: null, imageUrl: '', title: '', subtitle: '', linkUrl: '', sortOrder: '0' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/offers', { headers: authH })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Failed to load (HTTP ${res.status})`)
      setBanners(json.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.file && !form.imageUrl.trim()) {
      setError('Choose an image file or paste an image URL')
      return
    }
    setSaving(true); setError(''); setNotice('')
    try {
      // multipart so the file rides along with the text fields
      const body = new FormData()
      if (form.file) body.append('image', form.file)
      if (form.imageUrl.trim()) body.append('imageUrl', form.imageUrl.trim())
      body.append('title', form.title)
      body.append('subtitle', form.subtitle)
      body.append('linkUrl', form.linkUrl)
      body.append('sortOrder', form.sortOrder || '0')

      const res = await fetch('/api/admin/offers', { method: 'POST', headers: authH, body })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || `Upload failed (HTTP ${res.status})`)

      setNotice('Offer added')
      setForm({ file: null, imageUrl: '', title: '', subtitle: '', linkUrl: '', sortOrder: '0' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (banner) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/offers/${banner.id}`, {
        method: 'PATCH',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !banner.enabled }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Update failed')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async (banner) => {
    if (!window.confirm(`Delete this offer? The image file is removed too.`)) return
    setError('')
    try {
      const res = await fetch(`/api/admin/offers/${banner.id}`, { method: 'DELETE', headers: authH })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Delete failed')
      setNotice('Offer deleted')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const input = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none'

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={['Trade Master', 'Hero Banners']} />

      <div>
        <h1 className="text-3xl font-bold text-slate-100">Hero Banners</h1>
        <p className="text-sm text-slate-400">Hero banners shown on the trader dashboard</p>
      </div>

      {error && <div className="rounded-md border border-rose-700 bg-rose-900/30 px-4 py-2 text-sm text-rose-300">{error}</div>}
      {notice && <div className="rounded-md border border-emerald-700 bg-emerald-900/30 px-4 py-2 text-sm text-emerald-300">{notice}</div>}

      {/* Add */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-100">Add an offer</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Image file</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })}
              className="w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-100" />
            <p className="mt-1 text-[11px] text-slate-500">PNG, JPEG, WebP or GIF · max 5&nbsp;MB</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">…or image URL</label>
            <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://…" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Title (optional)</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Subtitle (optional)</label>
            <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Link (optional)</label>
            <input value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="/deposit or https://…" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Sort order</label>
            <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} className={input} />
            <p className="mt-1 text-[11px] text-slate-500">Lower shows first</p>
          </div>
        </div>
        <button onClick={create} disabled={saving}
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40">
          {saving ? 'Uploading…' : 'Add Offer'}
        </button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-slate-700">
        <div className="border-b border-slate-700 bg-slate-900 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-100">Current offers</h3>
        </div>
        <div className="divide-y divide-slate-800 bg-slate-950">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : banners.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No offers yet — the dashboard hero stays hidden until you add one.
            </p>
          ) : banners.map(b => (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <img src={b.imageUrl} alt={b.title || 'Offer'} className="h-14 w-28 shrink-0 rounded-md border border-slate-700 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{b.title || <span className="text-slate-500">(no title)</span>}</p>
                {b.subtitle && <p className="truncate text-xs text-slate-400">{b.subtitle}</p>}
                <p className="truncate text-[11px] text-slate-500">
                  {b.linkUrl || 'no link'} · order {b.sortOrder}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                b.enabled ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700/60 text-slate-400'
              }`}>
                {b.enabled ? 'Live' : 'Hidden'}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => toggle(b)}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                  {b.enabled ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => remove(b)}
                  className="rounded-md bg-rose-800 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
