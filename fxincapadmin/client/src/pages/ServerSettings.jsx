import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

export const ServerSettings = () => {
  const { token } = useAuth()

  // Provider management state
  const [providers, setProviders] = useState([])
  const [providersFetching, setProvidersFetching] = useState(false)
  const [editingProv, setEditingProv] = useState(null)
  const [savingProv, setSavingProv] = useState(false)
  const [providerError, setProviderError] = useState('')
  const [providerEmptyHint, setProviderEmptyHint] = useState('')

  // Build socket test URLs dynamically using API keys from the WS service
  const socketTargets = useMemo(() => {
    const provMap = {}
    providers.forEach((p) => { provMap[p.provider] = p })
    const tdKey = provMap.twelvedata?.api_key
    const fhKey = provMap.finnhub?.api_key
    return [
      {
        key: 'finnhub',
        name: 'Finnhub',
        url: fhKey ? `wss://ws.finnhub.io?token=${encodeURIComponent(fhKey)}` : 'wss://ws.finnhub.io',
        enabled: provMap.finnhub?.enabled,
      },
      {
        key: 'twelvedata',
        name: 'TwelveData',
        url: tdKey
          ? `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(tdKey)}`
          : 'wss://ws.twelvedata.com/v1/quotes/price',
        enabled: provMap.twelvedata?.enabled,
      },
      { key: 'binance', name: 'Binance', url: 'wss://stream.binance.com:9443/ws', enabled: provMap.binance?.enabled },
    ]
  }, [providers])

  const [userIdentifier, setUserIdentifier] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [confirmAllText, setConfirmAllText] = useState('')
  const [acknowledgeFullReset, setAcknowledgeFullReset] = useState(false)
  const [deleteUser, setDeleteUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [resetUserError, setResetUserError] = useState('')
  const [resetAllError, setResetAllError] = useState('')
  const [result, setResult] = useState(null)
  const [allResult, setAllResult] = useState(null)
  const [lastResetUserAt, setLastResetUserAt] = useState(null)
  const [lastResetAllAt, setLastResetAllAt] = useState(null)
  const [showResetUserModal, setShowResetUserModal] = useState(false)
  const [showResetAllModal, setShowResetAllModal] = useState(false)
  const [socketStatus, setSocketStatus] = useState({})
  const [monitoring, setMonitoring] = useState(false)
  const [wsHealth, setWsHealth] = useState(null)
  const [streamSymbol, setStreamSymbol] = useState('EURUSD')
  const [streamTesting, setStreamTesting] = useState(false)
  const [streamTestResult, setStreamTestResult] = useState(null)
  const [quoteSymbol, setQuoteSymbol] = useState('EURUSD')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteResult, setQuoteResult] = useState(null)

  // Email Keys state
  const [emailSettings, setEmailSettings] = useState({
    sendgridFrom: '',
    sendgridApiKey: '',
    maskedSendgridApiKey: '',
    hasSendgridApiKey: false,
    // SMTP
    smtpHost: 'smtpout.secureserver.net',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpFrom: '',
    smtpPassword: '',
    hasSmtpPassword: false,
    maskedSmtpPassword: '',
    // Provider selector
    emailProvider: 'sendgrid',
  })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState(null)

  const internalStreamUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/ws-admin/stream`
  }, [])

  const handleTestEmail = async () => {
    if (!testEmailTo.trim()) {
      setTestEmailResult({ type: 'error', text: 'Enter a recipient email address' })
      return
    }
    try {
      setTestEmailSending(true)
      setTestEmailResult(null)
      const response = await fetch('/api/admin/email-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to: testEmailTo.trim() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to send test email')
      setTestEmailResult({
        type: 'success',
        text: data.message || `Test email sent to ${testEmailTo}`,
        provider: data.provider,
        sentAt: data.sentAt,
      })
    } catch (error) {
      setTestEmailResult({ type: 'error', text: error?.message || 'Failed to send test email' })
    } finally {
      setTestEmailSending(false)
    }
  }

  const testSocketEndpoint = useCallback((target) => {
    const needsKey = target.key !== 'binance'
    const hasKeyInUrl =
      (target.url && (target.url.includes('token=') || target.url.includes('apikey='))) || false
    if (needsKey && !hasKeyInUrl) {
      return Promise.resolve({
        status: 'skipped',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        message: 'No API key in URL — set the key in WS Provider Settings above, then Reload',
      })
    }

    return new Promise((resolve) => {
      const startedAt = Date.now()
      let settled = false
      let ws

      const finish = (payload) => {
        if (settled) return
        settled = true
        resolve(payload)
      }

      try {
        ws = new WebSocket(target.url)
      } catch (connectError) {
        finish({
          status: 'failed',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          message: connectError?.message || 'WebSocket initialization failed',
        })
        return
      }

      const timeout = setTimeout(() => {
        try {
          ws?.close()
        } catch (_e) {
          // noop
        }
        finish({
          status: 'timeout',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          message: 'Connection timeout after 8s',
        })
      }, 8000)

      ws.onopen = () => {
        clearTimeout(timeout)
        const latencyMs = Date.now() - startedAt
        try {
          ws.close()
        } catch (_e) {
          // noop
        }
        finish({
          status: 'online',
          latencyMs,
          checkedAt: new Date().toISOString(),
          message: 'Socket handshake successful',
        })
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        finish({
          status: 'failed',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          message: 'Connection error',
        })
      }

      ws.onclose = () => {
        if (settled) return
        clearTimeout(timeout)
        finish({
          status: 'closed',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          message: 'Closed before successful handshake',
        })
      }
    })
  }, [])

  const runSocketMonitor = useCallback(async () => {
    setMonitoring(true)
    const checks = await Promise.all(socketTargets.map(testSocketEndpoint))
    const next = {}
    checks.forEach((state, index) => {
      next[socketTargets[index].key] = state
    })
    setSocketStatus(next)
    setMonitoring(false)
  }, [socketTargets, testSocketEndpoint])

  const fetchProviders = useCallback(async () => {
    setProvidersFetching(true)
    setProviderEmptyHint('')
    try {
      const res = await fetch('/api/ws-admin/admin/providers')
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        const list = json.providers || []
        setProviders(list)
        if (list.length === 0) {
          setProviderEmptyHint(
            'WS returned no provider rows. On the WS host: align PGHOST, PGUSER, PGPASSWORD, PGDATABASE with fxincapapi; restart fxincap-ws; or run fxincapws/sql/seed_ws_api_keys.sql on that database. Check fxincap-ws logs for "ws_api_keys has zero rows".'
          )
        }
      } else {
        setProviders([])
        const err = json?.error || `WS providers request failed (${res.status})`
        if (res.status === 401) {
          setProviderEmptyHint(
            `${err} Set WS_ADMIN_TOKEN on the admin server to match ADMIN_TOKEN on fxincap-ws.`
          )
        } else if (res.status === 503) {
          setProviderEmptyHint(`${err} Fix PostgreSQL credentials / network for fxincap-ws.`)
        } else {
          setProviderEmptyHint(err)
        }
      }
    } catch {
      setProviders([])
      setProviderEmptyHint('Could not reach the WS service through the admin proxy — check fxincap-ws is running and WS_SERVICE_URL on the admin server.')
    } finally {
      setProvidersFetching(false)
    }
  }, [])

  const saveProvider = async () => {
    if (!editingProv) return
    setSavingProv(true)
    setProviderError('')
    try {
      const res = await fetch(`/api/ws-admin/admin/providers/${encodeURIComponent(editingProv.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: editingProv.api_key, enabled: editingProv.enabled }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Save failed')
      setEditingProv(null)
      await fetchProviders()
      // Re-run socket monitor so it uses the updated API key
      setTimeout(() => runSocketMonitor(), 300)
    } catch (e) {
      setProviderError(e?.message || 'Failed to save provider')
    } finally {
      setSavingProv(false)
    }
  }

  const fetchWsHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/ws-admin/health')
      const json = await response.json().catch(() => null)
      if (!response.ok || !json) {
        throw new Error('Health endpoint unavailable')
      }
      setWsHealth(json)
    } catch (_error) {
      setWsHealth(null)
    }
  }, [])

  const handleInternalStreamTest = useCallback(async () => {
    const symbol = streamSymbol.trim().toUpperCase()
    if (!symbol) {
      setStreamTestResult({ type: 'error', message: 'Enter a symbol to subscribe' })
      return
    }

    setStreamTesting(true)
    setStreamTestResult(null)

    await new Promise((resolve) => {
      const startedAt = Date.now()
      let settled = false
      let timeoutId = null
      let ws

      const finish = (payload) => {
        if (settled) return
        settled = true
        if (timeoutId) clearTimeout(timeoutId)
        try {
          ws?.close()
        } catch {
          // noop
        }
        setStreamTestResult(payload)
        resolve(payload)
      }

      try {
        ws = new WebSocket(internalStreamUrl)
      } catch (error) {
        finish({
          type: 'error',
          message: error?.message || 'Failed to initialize internal stream socket',
          checkedAt: new Date().toISOString(),
        })
        return
      }

      timeoutId = setTimeout(() => {
        finish({
          type: 'error',
          message: 'No message received within 10s after subscribe',
          checkedAt: new Date().toISOString(),
        })
      }, 10000)

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'subscribe', symbol }))
      }

      ws.onmessage = (event) => {
        let payload = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          payload = event.data
        }
        finish({
          type: 'success',
          symbol,
          latencyMs: Date.now() - startedAt,
          checkedAt: new Date().toISOString(),
          payload,
        })
      }

      ws.onerror = () => {
        finish({
          type: 'error',
          message: 'Internal stream connection failed',
          checkedAt: new Date().toISOString(),
        })
      }

      ws.onclose = () => {
        if (settled) return
        finish({
          type: 'error',
          message: 'Internal stream closed before any message was received',
          checkedAt: new Date().toISOString(),
        })
      }
    })

    setStreamTesting(false)
  }, [internalStreamUrl, streamSymbol])

  const handleQuoteTest = useCallback(async () => {
    const symbol = quoteSymbol.trim().toUpperCase()
    if (!symbol) {
      setQuoteResult({ type: 'error', message: 'Enter a symbol to quote' })
      return
    }

    try {
      setQuoteLoading(true)
      setQuoteResult(null)
      const response = await fetch(`/api/ws-admin/quote/${encodeURIComponent(symbol)}`)
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Quote lookup failed')
      }
      setQuoteResult({
        type: 'success',
        symbol,
        quote: json.quote,
        checkedAt: new Date().toISOString(),
      })
    } catch (error) {
      setQuoteResult({
        type: 'error',
        message: error?.message || 'Quote lookup failed',
        checkedAt: new Date().toISOString(),
      })
    } finally {
      setQuoteLoading(false)
    }
  }, [quoteSymbol])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    if (!token) return
    const fetchEmailSettings = async () => {
      try {
        const res = await fetch('/api/admin/email-settings', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.success) {
          const d = data.data
          setEmailSettings({
            sendgridFrom: d.sendgridFrom || '',
            sendgridApiKey: '',
            maskedSendgridApiKey: d.maskedSendgridApiKey || '',
            hasSendgridApiKey: d.hasSendgridApiKey === true,
            smtpHost: d.smtpHost || 'smtpout.secureserver.net',
            smtpPort: d.smtpPort || 465,
            smtpSecure: d.smtpSecure !== false,
            smtpUser: d.smtpUser || '',
            smtpFrom: d.smtpFrom || '',
            smtpPassword: '',
            hasSmtpPassword: d.hasSmtpPassword === true,
            maskedSmtpPassword: d.maskedSmtpPassword || '',
            emailProvider: d.emailProvider || 'sendgrid',
          })
        }
      } catch {
        // WS service or API unreachable
      }
    }
    fetchEmailSettings()
  }, [token])

  useEffect(() => {
    runSocketMonitor()
    fetchWsHealth()
    const interval = setInterval(() => {
      runSocketMonitor()
      fetchWsHealth()
    }, 45000)
    return () => clearInterval(interval)
  }, [fetchWsHealth, runSocketMonitor])

  const handleReset = async () => {
    setResetUserError('')
    setResult(null)

    if (!userIdentifier.trim()) {
      setResetUserError('Please enter user ID or email')
      return
    }
    if (confirmText.trim() !== 'RESET USER DATA') {
      setResetUserError('Type RESET USER DATA to confirm this action')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/server-settings/reset-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userIdentifier: userIdentifier.trim(),
          deleteUser,
          confirmText: confirmText.trim(),
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to reset user data')
      }

      setResult(json)
      setConfirmText('')
      setLastResetUserAt(new Date().toISOString())
      setShowResetUserModal(false)
    } catch (err) {
      setResetUserError(err?.message || 'Failed to reset user data')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSettingChange = (field, value) => {
    setEmailSettings((prev) => ({ ...prev, [field]: value }))
    setEmailMessage(null)
  }

  const handleEmailSave = async () => {
    try {
      setEmailSaving(true)
      const response = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sendgridFrom: emailSettings.sendgridFrom,
          sendgridApiKey: emailSettings.sendgridApiKey,
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpSecure: emailSettings.smtpSecure,
          smtpUser: emailSettings.smtpUser,
          smtpFrom: emailSettings.smtpFrom,
          smtpPassword: emailSettings.smtpPassword,
          emailProvider: emailSettings.emailProvider,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to save email settings')
      const d = data.data
      setEmailSettings((prev) => ({
        ...prev,
        sendgridApiKey: '',
        maskedSendgridApiKey: d.maskedSendgridApiKey || prev.maskedSendgridApiKey,
        hasSendgridApiKey: d.hasSendgridApiKey === true,
        sendgridFrom: d.sendgridFrom || prev.sendgridFrom,
        smtpHost: d.smtpHost || prev.smtpHost,
        smtpPort: d.smtpPort || prev.smtpPort,
        smtpSecure: d.smtpSecure !== false,
        smtpUser: d.smtpUser || prev.smtpUser,
        smtpFrom: d.smtpFrom || prev.smtpFrom,
        smtpPassword: '',
        hasSmtpPassword: d.hasSmtpPassword === true,
        maskedSmtpPassword: d.maskedSmtpPassword || prev.maskedSmtpPassword,
        emailProvider: d.emailProvider || prev.emailProvider,
      }))
      setEmailMessage({ type: 'success', text: 'Email settings saved successfully' })
    } catch (error) {
      setEmailMessage({ type: 'error', text: error?.message || 'Failed to save email settings' })
    } finally {
      setEmailSaving(false)
    }
  }

  const handleResetAllUsers = async () => {
    setResetAllError('')
    setAllResult(null)

    if (confirmAllText.trim() !== 'RESET ALL USER DATA') {
      setResetAllError('Type RESET ALL USER DATA to confirm full reset')
      return
    }
    if (!acknowledgeFullReset) {
      setResetAllError('Please confirm that you understand this action is permanent')
      return
    }

    try {
      setLoadingAll(true)
      const response = await fetch('/api/admin/server-settings/reset-all-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          confirmText: confirmAllText.trim(),
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to reset all users data')
      }

      setAllResult(json)
      setConfirmAllText('')
      setAcknowledgeFullReset(false)
      setLastResetAllAt(new Date().toISOString())
      setShowResetAllModal(false)
    } catch (err) {
      setResetAllError(err?.message || 'Failed to reset all users data')
    } finally {
      setLoadingAll(false)
    }
  }

  return (
    <>
      <Breadcrumb items={['Settings', 'Server Settings']} />
      <Card
        title="Server Settings"
        footer="Use this action carefully. Resets are permanent and should be done only by authorized admins."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 rounded-lg border border-indigo-700/40 bg-indigo-950/20 p-4 lg:col-span-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">WS Provider Settings</h3>
                <button
                  onClick={fetchProviders}
                  disabled={providersFetching}
                  className="rounded bg-indigo-700/50 px-2 py-1 text-xs text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  {providersFetching ? '...' : 'Reload'}
                </button>
              </div>

              {providers.length === 0 && !providersFetching && (
                <p className="text-xs text-slate-400">
                  {providerEmptyHint || 'No provider data — use Reload after fixing WS DB connection.'}
                </p>
              )}

              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.provider} className="rounded-md border border-slate-700/60 bg-slate-900/50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium capitalize text-slate-100">{p.provider}</span>
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${p.enabled ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700/60 text-slate-400'}`}>
                          {p.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <button
                        onClick={() => { setEditingProv({ name: p.provider, api_key: p.api_key || '', enabled: !!p.enabled }); setProviderError('') }}
                        className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-600"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Key: {p.api_key ? `****${String(p.api_key).slice(-6)}` : <span className="text-rose-400">Not set</span>}
                    </p>
                  </div>
                ))}
              </div>

              {editingProv && (
                <div className="mt-3 space-y-2 rounded-md border border-indigo-600/50 bg-slate-900/70 p-3">
                  <h4 className="text-xs font-semibold uppercase capitalize text-indigo-300">{editingProv.name} — Edit</h4>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">API Key</label>
                    <input
                      value={editingProv.api_key}
                      onChange={(e) => setEditingProv((prev) => ({ ...prev, api_key: e.target.value }))}
                      placeholder="Enter API key..."
                      className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingProv.enabled}
                      onChange={(e) => setEditingProv((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800"
                    />
                    Set as active provider
                  </label>
                  {providerError && <p className="text-xs text-rose-400">{providerError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveProvider}
                      disabled={savingProv}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingProv ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingProv(null); setProviderError('') }}
                      className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-12 rounded-lg border border-sky-600/40 bg-sky-950/20 p-4 lg:col-span-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">Live API / Socket Monitor</h3>
                  <p className="mt-1 text-sm text-slate-300">Real-time connectivity status for market data providers.</p>
                </div>
                <button
                  onClick={runSocketMonitor}
                  disabled={monitoring}
                  className="rounded-md bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {monitoring ? 'Checking...' : 'Refresh Status'}
                </button>
              </div>

              {wsHealth && (
                <div className="mb-3 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                  <div>WS Service Health: status={wsHealth.status || 'unknown'} | provider={wsHealth.provider || 'n/a'} | provider_status={wsHealth.provider_status || 'unknown'} | clients={wsHealth.ws_clients ?? 'n/a'}</div>
                  {wsHealth.provider_error && (
                    <div className="mt-1 text-rose-300">Provider Load Error: {wsHealth.provider_error}</div>
                  )}
                  {wsHealth.provider_loaded_at && (
                    <div className="mt-1 text-slate-400">Provider Loaded At: {new Date(wsHealth.provider_loaded_at).toLocaleString()}</div>
                  )}
                </div>
              )}

              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-md border border-slate-700 bg-slate-900/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-300">Internal Stream Test</h4>
                  <p className="mt-1 text-xs text-slate-400">Checks the proxied WS stream, subscribes to one symbol, and waits for the first message.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={streamSymbol}
                      onChange={(e) => setStreamSymbol(e.target.value)}
                      placeholder="EURUSD"
                      className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      onClick={handleInternalStreamTest}
                      disabled={streamTesting}
                      className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-60"
                    >
                      {streamTesting ? 'Testing...' : 'Test Stream'}
                    </button>
                  </div>
                  {streamTestResult && (
                    <div className={`mt-3 rounded border px-3 py-2 text-xs ${streamTestResult.type === 'success' ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200' : 'border-rose-700/50 bg-rose-950/20 text-rose-200'}`}>
                      <div>{streamTestResult.type === 'success' ? `Received first message in ${streamTestResult.latencyMs}ms` : streamTestResult.message}</div>
                      {streamTestResult.checkedAt && <div className="mt-1 text-slate-300">Checked: {new Date(streamTestResult.checkedAt).toLocaleTimeString()}</div>}
                      {streamTestResult.payload && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-200">{JSON.stringify(streamTestResult.payload, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-slate-700 bg-slate-900/50 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-300">Quote Test</h4>
                  <p className="mt-1 text-xs text-slate-400">Checks the proxied quote endpoint for a single symbol through the WS service.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={quoteSymbol}
                      onChange={(e) => setQuoteSymbol(e.target.value)}
                      placeholder="EURUSD"
                      className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      onClick={handleQuoteTest}
                      disabled={quoteLoading}
                      className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-60"
                    >
                      {quoteLoading ? 'Checking...' : 'Get Quote'}
                    </button>
                  </div>
                  {quoteResult && (
                    <div className={`mt-3 rounded border px-3 py-2 text-xs ${quoteResult.type === 'success' ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200' : 'border-rose-700/50 bg-rose-950/20 text-rose-200'}`}>
                      <div>{quoteResult.type === 'success' ? `Quote loaded for ${quoteResult.symbol}` : quoteResult.message}</div>
                      {quoteResult.checkedAt && <div className="mt-1 text-slate-300">Checked: {new Date(quoteResult.checkedAt).toLocaleTimeString()}</div>}
                      {quoteResult.quote && (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-200">{JSON.stringify(quoteResult.quote, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-200">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Active</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Latency</th>
                      <th className="py-2 pr-4">Last Check</th>
                      <th className="py-2 pr-4">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {socketTargets.map((target) => {
                      const state = socketStatus[target.key] || {}
                      const status = state.status || 'pending'
                      const statusColor =
                        status === 'online'
                          ? 'text-emerald-300'
                          : status === 'pending'
                            ? 'text-amber-300'
                            : status === 'skipped'
                              ? 'text-slate-400'
                              : 'text-rose-300'
                      return (
                        <tr key={target.key} className="border-b border-slate-800/80 align-top">
                          <td className="py-2 pr-4 font-medium">{target.name}</td>
                          <td className="py-2 pr-4">
                            {target.enabled == null ? <span className="text-slate-500">—</span>
                              : target.enabled ? <span className="text-emerald-300">Yes</span>
                              : <span className="text-slate-500">No</span>}
                          </td>
                          <td className={`py-2 pr-4 font-semibold uppercase ${statusColor}`}>{status}</td>
                          <td className="py-2 pr-4">{state.latencyMs != null ? `${state.latencyMs}ms` : '—'}</td>
                          <td className="py-2 pr-4 text-xs text-slate-400">{state.checkedAt ? new Date(state.checkedAt).toLocaleTimeString() : '—'}</td>
                          <td className="py-2 pr-4 text-xs text-slate-400">{state.message || 'Waiting for check'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 rounded-lg border border-rose-700/60 bg-rose-950/25 p-4 lg:col-span-3">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-300">Reset User & Releted Data</h3>
              <p className="mb-4 text-sm text-slate-300">Open modal and submit target user with confirmation.</p>
              <button
                onClick={() => setShowResetUserModal(true)}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Open Reset User Modal
              </button>
            </div>

            <div className="col-span-12 rounded-lg border border-slate-700 bg-slate-900/40 p-4 lg:col-span-9">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">Status Report: Reset User</h3>
              <p className="mb-3 text-xs text-slate-400">Last run: {lastResetUserAt ? new Date(lastResetUserAt).toLocaleString() : 'Not executed yet'}</p>

              {resetUserError && (
                <div className="mb-3 rounded-md border border-rose-600/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">Error: {resetUserError}</div>
              )}

              {result?.success ? (
                <>
                  <p className="mb-2 text-sm text-slate-200">User: {result?.user?.email || result?.user?.id}</p>
                  <p className="mb-2 text-xs text-slate-400">{result?.message || 'Reset completed'}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-200">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="py-2 pr-4">Table</th>
                          <th className="py-2 pr-4">Rows Deleted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result?.deleted || {}).map(([tableName, count]) => (
                          <tr key={tableName} className="border-b border-slate-800/80">
                            <td className="py-2 pr-4">{tableName}</td>
                            <td className="py-2 pr-4">{count}</td>
                          </tr>
                        ))}
                        {Object.keys(result?.deleted || {}).length === 0 && (
                          <tr>
                            <td className="py-2 pr-4" colSpan={2}>No related rows matched for deletion.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">No reset result yet.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 rounded-lg border border-rose-700/60 bg-rose-950/25 p-4 lg:col-span-3">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-300">Reset All Users & Releted Data</h3>
              <p className="mb-4 text-sm text-slate-300">Open modal and run full reset with hard confirmation.</p>
              <button
                onClick={() => setShowResetAllModal(true)}
                className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
              >
                Open Full Reset Modal
              </button>
            </div>

            <div className="col-span-12 rounded-lg border border-slate-700 bg-slate-900/40 p-4 lg:col-span-9">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">Status Report: Reset All Users</h3>
              <p className="mb-3 text-xs text-slate-400">Last run: {lastResetAllAt ? new Date(lastResetAllAt).toLocaleString() : 'Not executed yet'}</p>

              {resetAllError && (
                <div className="mb-3 rounded-md border border-rose-600/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">Error: {resetAllError}</div>
              )}

              {allResult?.success ? (
                <>
                  <p className="mb-2 text-xs text-slate-400">{allResult?.message || 'Full reset completed'}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-200">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="py-2 pr-4">Table</th>
                          <th className="py-2 pr-4">Rows Deleted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(allResult?.deleted || {}).map(([tableName, count]) => (
                          <tr key={tableName} className="border-b border-slate-800/80">
                            <td className="py-2 pr-4">{tableName}</td>
                            <td className="py-2 pr-4">{count}</td>
                          </tr>
                        ))}
                        {Object.keys(allResult?.deleted || {}).length === 0 && (
                          <tr>
                            <td className="py-2 pr-4" colSpan={2}>No related rows matched for deletion.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">No full reset result yet.</p>
              )}
            </div>
          </div>

          {/* Email Settings */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6">
              <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-300">Email Settings</h3>
                <p className="mb-4 text-xs text-slate-400">Configure email delivery. Choose the active provider and enter credentials. If the active provider fails, the other acts as fallback.</p>

                {emailMessage && (
                  <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${
                    emailMessage.type === 'success'
                      ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
                  }`}>
                    {emailMessage.text}
                  </div>
                )}

                {/* Provider selector */}
                <div className="mb-5">
                  <p className="mb-2 text-xs font-medium text-slate-300">Active Email Provider</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEmailSettingChange('emailProvider', 'sendgrid')}
                      className={`rounded-md border px-4 py-2 text-xs font-medium transition-colors ${
                        emailSettings.emailProvider === 'sendgrid'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      SendGrid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmailSettingChange('emailProvider', 'smtp')}
                      className={`rounded-md border px-4 py-2 text-xs font-medium transition-colors ${
                        emailSettings.emailProvider === 'smtp'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      GoDaddy SMTP
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {emailSettings.emailProvider === 'sendgrid'
                      ? 'SendGrid is active. SMTP will be used as fallback if SendGrid fails.'
                      : 'GoDaddy SMTP is active. SendGrid will be used as fallback if SMTP fails.'}
                  </p>
                </div>

                {/* SendGrid section */}
                <div className="mb-5">
                  <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">SendGrid</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">From Email</label>
                      <input
                        type="email"
                        value={emailSettings.sendgridFrom}
                        onChange={(e) => handleEmailSettingChange('sendgridFrom', e.target.value)}
                        placeholder="noreply@example.com"
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">API Key</label>
                      <input
                        type="password"
                        value={emailSettings.sendgridApiKey}
                        onChange={(e) => handleEmailSettingChange('sendgridApiKey', e.target.value)}
                        placeholder={emailSettings.hasSendgridApiKey ? emailSettings.maskedSendgridApiKey || 'Stored — leave blank to keep' : 'SG.xxxxx'}
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {emailSettings.hasSendgridApiKey
                          ? `Stored: ${emailSettings.maskedSendgridApiKey || 'configured'}. Leave blank to keep.`
                          : 'No key stored yet.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SMTP section */}
                <div className="mb-5">
                  <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">GoDaddy Workspace SMTP</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">SMTP Host</label>
                      <input
                        type="text"
                        value={emailSettings.smtpHost}
                        onChange={(e) => handleEmailSettingChange('smtpHost', e.target.value)}
                        placeholder="smtpout.secureserver.net"
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">Port</label>
                      <input
                        type="number"
                        value={emailSettings.smtpPort}
                        onChange={(e) => handleEmailSettingChange('smtpPort', parseInt(e.target.value, 10) || 465)}
                        placeholder="465"
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={emailSettings.smtpSecure}
                          onChange={(e) => handleEmailSettingChange('smtpSecure', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-amber-500"
                        />
                        SSL / Secure (port 465)
                      </label>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">Username (Email)</label>
                      <input
                        type="email"
                        value={emailSettings.smtpUser}
                        onChange={(e) => handleEmailSettingChange('smtpUser', e.target.value)}
                        placeholder="support@curreex.com"
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">Password</label>
                      <input
                        type="password"
                        value={emailSettings.smtpPassword}
                        onChange={(e) => handleEmailSettingChange('smtpPassword', e.target.value)}
                        placeholder={emailSettings.hasSmtpPassword ? emailSettings.maskedSmtpPassword || 'Stored — leave blank to keep' : 'Enter SMTP password'}
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {emailSettings.hasSmtpPassword ? 'Password stored. Leave blank to keep.' : 'No password stored yet.'}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-300">From Address</label>
                      <input
                        type="email"
                        value={emailSettings.smtpFrom}
                        onChange={(e) => handleEmailSettingChange('smtpFrom', e.target.value)}
                        placeholder="support@curreex.com"
                        className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <button
                    onClick={handleEmailSave}
                    disabled={emailSaving}
                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {emailSaving ? 'Saving...' : 'Save Email Settings'}
                  </button>
                </div>

                {/* Test Email */}
                <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Send Test Email</p>
                  <p className="mb-4 text-[11px] text-slate-500">Send a test message to verify the active provider is delivering correctly.</p>

                  <div className="mb-3">
                    <label className="mb-1 block text-xs text-slate-300">Recipient Email</label>
                    <input
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => { setTestEmailTo(e.target.value); setTestEmailResult(null) }}
                      placeholder="youremail@example.com"
                      className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleTestEmail}
                    disabled={testEmailSending || !testEmailTo.trim()}
                    className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testEmailSending ? 'Sending...' : 'Send Test Email'}
                  </button>

                  {testEmailResult && (
                    <div className={`mt-4 rounded-md border px-3 py-3 text-xs ${
                      testEmailResult.type === 'success'
                        ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/70 bg-rose-500/10 text-rose-300'
                    }`}>
                      <p className="font-medium">{testEmailResult.type === 'success' ? '✓ Delivered' : '✗ Failed'}</p>
                      <p className="mt-1">{testEmailResult.text}</p>
                      {testEmailResult.provider && (
                        <p className="mt-1 text-[11px] opacity-70">Provider: {testEmailResult.provider.toUpperCase()}{testEmailResult.sentAt ? ` · ${new Date(testEmailResult.sentAt).toLocaleTimeString()}` : ''}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Right col — empty for now */}
            <div className="col-span-12 lg:col-span-6"></div>
          </div>

          {showResetUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6">
                <h3 className="mb-2 text-lg font-semibold text-slate-100">Reset User & Releted Data</h3>
                <p className="mb-4 text-sm text-slate-400">Enter a user identifier and confirmation to run targeted reset.</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-slate-300">User ID or Email</label>
                    <input
                      value={userIdentifier}
                      onChange={(e) => setUserIdentifier(e.target.value)}
                      placeholder="e.g. c07fac3e-... or user@example.com"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300">Confirmation Text</label>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type: RESET USER DATA"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={deleteUser}
                    onChange={(e) => setDeleteUser(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  Also delete user account row from users table
                </label>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowResetUserModal(false)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={loading}
                    className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Resetting...' : 'Run Reset'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showResetAllModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6">
                <h3 className="mb-2 text-lg font-semibold text-slate-100">Reset All Users & Releted Data</h3>
                <p className="mb-4 text-sm text-slate-400">This is destructive and permanent. Enter the exact confirmation to continue.</p>

                <label className="mb-2 block text-sm text-slate-300">Confirmation Text</label>
                <input
                  value={confirmAllText}
                  onChange={(e) => setConfirmAllText(e.target.value)}
                  placeholder="Type: RESET ALL USER DATA"
                  className="mb-4 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />

                <label className="mb-4 flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={acknowledgeFullReset}
                    onChange={(e) => setAcknowledgeFullReset(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  I understand this is permanent and cannot be undone.
                </label>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowResetAllModal(false)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetAllUsers}
                    disabled={loadingAll || !acknowledgeFullReset}
                    className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingAll ? 'Resetting All...' : 'Run Full Reset'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
