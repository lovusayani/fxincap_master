import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Save, Image as ImageIcon, Eye } from 'lucide-react'

const REQUIRED_FIELDS = ['header', 'footer', 'bodyRegistration', 'bodyLogin']

const Label = ({ children, required }) => (
  <label className="mb-1 block text-xs text-slate-300">
    {children}
    {required && <span className="ml-0.5 text-rose-400">*</span>}
  </label>
)

const FieldError = ({ show, children }) =>
  show ? <p className="mt-1 text-[11px] text-rose-400">{children}</p> : null

export const EmailSettings = () => {
  const { token } = useAuth()
  const [form, setForm] = useState({
    logoUrl: '', header: '', footer: '', bodyRegistration: '', bodyLogin: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [touched, setTouched] = useState({})
  const [showPreview, setShowPreview] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/email-branding', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load email settings')
      setForm({
        logoUrl: json.data.logoUrl || '',
        header: json.data.header || '',
        footer: json.data.footer || '',
        bodyRegistration: json.data.bodyRegistration || '',
        bodyLogin: json.data.bodyLogin || '',
      })
      setMessage(null)
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load email settings' })
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

  const missing = REQUIRED_FIELDS.filter((f) => !String(form[f] || '').trim())
  const logoInvalid = Boolean(form.logoUrl.trim()) && !/^https?:\/\//i.test(form.logoUrl.trim())

  const save = async () => {
    setTouched(Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, true])))
    if (missing.length > 0) {
      setMessage({ type: 'error', text: `Please fill all required fields: ${missing.join(', ')}` })
      return
    }
    if (logoInvalid) {
      setMessage({ type: 'error', text: 'Logo URL must be a full http(s) URL.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/email-branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save')
      setForm({
        logoUrl: json.data.logoUrl || '',
        header: json.data.header || '',
        footer: json.data.footer || '',
        bodyRegistration: json.data.bodyRegistration || '',
        bodyLogin: json.data.bodyLogin || '',
      })
      setMessage({ type: 'success', text: json.message || 'Email settings saved successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = (invalid) =>
    `h-9 w-full rounded-md border bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none ${
      invalid ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-700 focus:border-amber-500'
    }`
  const areaCls = (invalid) =>
    `w-full rounded-md border bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none ${
      invalid ? 'border-rose-500/70 focus:border-rose-500' : 'border-slate-700 focus:border-amber-500'
    }`

  if (loading) {
    return (
      <>
        <Breadcrumb items={['Home', 'Settings', 'Email Setting']} />
        <div className="h-96 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40" />
      </>
    )
  }

  return (
    <>
      <Breadcrumb items={['Home', 'Settings', 'Email Setting']} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Email Setting</h1>
          <p className="text-[11px] text-slate-500">
            Branding applies to every transactional email — registration, deposit, withdrawal and trade execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <Eye className="h-3.5 w-3.5" />{showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button
            onClick={load}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />Reload
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${
          message.type === 'success'
            ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
        }`}>{message.text}</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Branding — applies to all emails */}
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-300">Branding</h3>
            <p className="mb-4 text-xs text-slate-400">
              Shown on <strong>all</strong> emails: registration, deposit, withdrawal and trade execution.
            </p>

            <div className="mb-4">
              <Label>Logo URL</Label>
              <div className="flex gap-2">
                <input
                  value={form.logoUrl}
                  onChange={(e) => change('logoUrl', e.target.value)}
                  placeholder="https://ncapfx.com/logo.png"
                  className={inputCls(logoInvalid)}
                />
                <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900">
                  {form.logoUrl && !logoInvalid ? (
                    <img src={form.logoUrl} alt="" className="max-h-7 max-w-[46px] object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-slate-600" />
                  )}
                </div>
              </div>
              <FieldError show={logoInvalid}>Must be a full http(s) URL — email clients cannot load relative paths.</FieldError>
              {!logoInvalid && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Optional. Must be publicly reachable — email clients load it remotely.
                </p>
              )}
            </div>

            <div className="mb-4">
              <Label required>Header</Label>
              <input
                value={form.header}
                onChange={(e) => change('header', e.target.value)}
                placeholder="Curreex"
                className={inputCls(touched.header && !form.header.trim())}
              />
              <FieldError show={touched.header && !form.header.trim()}>Header is required.</FieldError>
            </div>

            <div>
              <Label required>Footer</Label>
              <textarea
                rows={3}
                value={form.footer}
                onChange={(e) => change('footer', e.target.value)}
                placeholder="This is an automated message — please do not reply directly to this email."
                className={areaCls(touched.footer && !form.footer.trim())}
              />
              <FieldError show={touched.footer && !form.footer.trim()}>Footer is required.</FieldError>
              <p className="mt-1 text-[11px] text-slate-500">Line breaks are preserved. Good place for legal or contact info.</p>
            </div>
          </div>

          {/* Body copy — registration & login only */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300">Email Body Message</h3>
            <p className="mb-4 text-xs text-slate-400">
              Editable for registration and login emails only. Deposit, withdrawal and trade emails have
              fixed wording because they carry transaction figures.
            </p>

            <div className="mb-4">
              <Label required>Registration Email Body</Label>
              <textarea
                rows={4}
                value={form.bodyRegistration}
                onChange={(e) => change('bodyRegistration', e.target.value)}
                placeholder="Welcome aboard! Use the verification code below to activate your account."
                className={areaCls(touched.bodyRegistration && !form.bodyRegistration.trim())}
              />
              <FieldError show={touched.bodyRegistration && !form.bodyRegistration.trim()}>
                Registration body is required.
              </FieldError>
              <p className="mt-1 text-[11px] text-slate-500">
                Appears above the verification code. The code and Verify button are added automatically.
              </p>
            </div>

            <div>
              <Label required>Login / Password Reset Email Body</Label>
              <textarea
                rows={4}
                value={form.bodyLogin}
                onChange={(e) => change('bodyLogin', e.target.value)}
                placeholder="We received a request to reset your password. Use the code below."
                className={areaCls(touched.bodyLogin && !form.bodyLogin.trim())}
              />
              <FieldError show={touched.bodyLogin && !form.bodyLogin.trim()}>
                Login body is required.
              </FieldError>
              <p className="mt-1 text-[11px] text-slate-500">
                Appears above the reset code. The code and Reset button are added automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || missing.length > 0 || logoInvalid}
              className="flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Email Settings'}
            </button>
            {missing.length > 0 && (
              <span className="text-[11px] text-rose-400">{missing.length} required field(s) empty</span>
            )}
          </div>
        </div>

        {/* Live preview */}
        {showPreview && (
          <div className="xl:col-span-1">
            <div className="sticky top-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-100">Live Preview</h3>
              <div className="rounded-lg bg-[#05070b] p-3">
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f1a]">
                  <div className="border-b border-slate-800 px-5 py-5 text-center">
                    {form.logoUrl && !logoInvalid && (
                      <img src={form.logoUrl} alt="" className="mx-auto mb-3 max-h-11 max-w-[200px] object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    )}
                    <p className="text-base font-bold tracking-wide text-slate-200">
                      {form.header || <span className="text-slate-600">Header</span>}
                    </p>
                  </div>
                  <div className="px-5 py-5 text-slate-200">
                    <h4 className="mb-3 text-base font-semibold text-[#f6d505]">Verify your email address</h4>
                    <p className="mb-2 text-[13px]">Hi Richa,</p>
                    <p className="mb-4 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">
                      {form.bodyRegistration || <span className="text-slate-600">Registration body message</span>}
                    </p>
                    <p className="my-4 text-center font-mono text-2xl font-bold tracking-[0.35em] text-slate-50">123456</p>
                    <p className="text-center">
                      <span className="inline-block rounded-md bg-[#ffe300] px-6 py-2 text-[13px] font-semibold text-black">Verify Email</span>
                    </p>
                  </div>
                  <div className="border-t border-slate-800 bg-[#080c14] px-5 py-4">
                    <p className="whitespace-pre-wrap text-center text-[10px] leading-relaxed text-slate-500">
                      {form.footer || <span className="text-slate-700">Footer</span>}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Showing the registration email. Deposit, withdrawal and trade emails use the same
                header, logo and footer with their own body content.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
