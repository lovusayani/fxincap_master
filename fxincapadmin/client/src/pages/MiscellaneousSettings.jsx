import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'

export const MiscellaneousSettings = () => {
  const { token } = useAuth()
  const [settings, setSettings] = useState({
    topbarBgColor: 'default',
    shadcnTheme: 'default',
    platformFontSize: '16px',
    glossyEffect: 'on',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [logos, setLogos] = useState({ light: null, dark: null, square: null })
  const [logoUploading, setLogoUploading] = useState({ light: false, dark: false, square: false })
  const logoInputLight = useRef(null)
  const logoInputDark = useRef(null)
  const logoInputSquare = useRef(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/admin/style-settings', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to fetch settings')
        }

        setSettings({
          topbarBgColor: data.data.topbarBgColor || data.data.headerColor || 'default',
          shadcnTheme: data.data.shadcnTheme || 'default',
          platformFontSize: data.data.platformFontSize || '16px',
          glossyEffect: data.data.glossyEffect || 'on',
        })
        setLogos({
          light: data.data.logoLightUrl || null,
          dark: data.data.logoDarkUrl || null,
          square: data.data.logoSquareUrl || null,
        })

        setMessage(null)
      } catch (error) {
        setMessage({ type: 'error', text: error?.message || 'Failed to load settings' })
      } finally {
        setLoading(false)
      }
    }

    if (token) fetchSettings()
  }, [token])

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setUnsavedChanges(true)
    setMessage(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/style-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to save settings')

      setMessage({ type: 'success', text: 'Settings saved successfully' })
      setUnsavedChanges(false)
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (type, file) => {
    if (!file) return
    if (file.type !== 'image/png') {
      setMessage({ type: 'error', text: 'Only PNG files are allowed for logos' })
      return
    }

    const formData = new FormData()
    formData.append('logo', file)
    formData.append('type', type)

    try {
      setLogoUploading((prev) => ({ ...prev, [type]: true }))
      const response = await fetch('/api/admin/logo-upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Upload failed')
      setLogos((prev) => ({ ...prev, [type]: data.data.logoUrl }))
      setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} logo uploaded` })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Logo upload failed' })
    } finally {
      setLogoUploading((prev) => ({ ...prev, [type]: false }))
    }
  }

  const handleLogoDelete = async (type) => {
    if (!window.confirm(`Remove ${type} logo?`)) return

    try {
      const response = await fetch('/api/admin/logo-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Delete failed')
      setLogos((prev) => ({ ...prev, [type]: null }))
      setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} logo removed` })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Logo delete failed' })
    }
  }

  return (
    <div className="w-full max-w-none p-3 md:p-5 xl:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">Miscellaneous Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Shadcn UI controls for platform appearance and frontend styling.</p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-md border px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Appearance And Frontend Controls</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="topbarBgColor">Topbar BG Color</Label>
                  <Select id="topbarBgColor" value={settings.topbarBgColor} onChange={(e) => handleChange('topbarBgColor', e.target.value)}>
                    <option value="default">Default (System default theme wise)</option>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="shadcnTheme">Theme</Label>
                  <Select id="shadcnTheme" value={settings.shadcnTheme} onChange={(e) => handleChange('shadcnTheme', e.target.value)}>
                    <option value="default">Default</option>
                    <option value="neutral">Neutral</option>
                    <option value="amber">Amber</option>
                    <option value="blue">Blue</option>
                    <option value="cyan">Cyan</option>
                    <option value="pink">Pink</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="platformFontSize">Font Size</Label>
                  <Select id="platformFontSize" value={settings.platformFontSize} onChange={(e) => handleChange('platformFontSize', e.target.value)}>
                    <option value="8px">8px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="glossyEffect">Glossy Effect (Cards Only)</Label>
                  <Select id="glossyEffect" value={settings.glossyEffect} onChange={(e) => handleChange('glossyEffect', e.target.value)}>
                    <option value="on">Glossy On (Cards)</option>
                    <option value="off">Glossy Off</option>
                  </Select>
                </div>

                <p className="text-xs text-slate-400">These values sync to trade.fxincap.com through style-settings API.</p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSave} disabled={!unsavedChanges || saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {unsavedChanges && (
                    <Button variant="secondary" onClick={() => { setUnsavedChanges(false); setMessage(null) }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-slate-400">PNG only. Light and Dark: 162×52 px. Square: 64×64 px.</p>

            {[
              { type: 'light', label: 'Light Logo', hint: '162 × 52 px', ref: logoInputLight },
              { type: 'dark', label: 'Dark Logo', hint: '162 × 52 px', ref: logoInputDark },
              { type: 'square', label: 'Square Logo', hint: '64 × 64 px', ref: logoInputSquare },
            ].map(({ type, label, hint, ref }) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500">{hint}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => ref.current && ref.current.click()}
                      disabled={logoUploading[type]}
                      className="rounded-md border border-blue-500/40 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
                    >
                      {logoUploading[type] ? 'Uploading...' : 'Upload'}
                    </button>
                    {logos[type] && (
                      <button
                        type="button"
                        onClick={() => handleLogoDelete(type)}
                        className="rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={ref}
                  type="file"
                  accept=".png,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoUpload(type, file)
                    e.target.value = ''
                  }}
                />

                {logos[type] ? (
                  <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
                    <img
                      src={logos[type]}
                      alt={`${label} preview`}
                      className={`object-contain ${type === 'square' ? 'h-10 w-10' : 'h-8 max-w-full'}`}
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/50 px-3 py-4 text-center text-xs text-slate-500">
                    No logo uploaded
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
