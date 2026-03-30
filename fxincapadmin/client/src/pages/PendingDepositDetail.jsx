import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'


const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A'
  const date = new Date(dateValue)
  if (isNaN(date.getTime())) return 'Invalid Date'
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

export const PendingDepositDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchDetail = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`/api/admin/funds/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        })

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body?.error || `Request failed with ${resp.status}`)
        }

        const json = await resp.json()
        if (json.success && json.data) {
          setData(json.data)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Failed to load deposit details')
      } finally {
        setLoading(false)
      }
    }

    if (id && token) fetchDetail()
    return () => controller.abort()
  }, [id, token])

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to APPROVE this deposit?')) return
    setProcessing(true)
    try {
      const resp = await fetch(`/api/admin/funds/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const json = await resp.json()
      if (!resp.ok || !json.success) {
        throw new Error(json?.error || 'Failed to approve')
      }

      alert('Deposit approved successfully!')
      navigate('/all-pendings')
    } catch (err) {
      alert(`Approval failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Are you sure you want to REJECT this deposit?')) return
    setProcessing(true)
    try {
      const resp = await fetch(`/api/admin/funds/${id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const json = await resp.json()
      if (!resp.ok || !json.success) {
        throw new Error(json?.error || 'Failed to reject')
      }

      alert('Deposit rejected successfully!')
      navigate('/all-pendings')
    } catch (err) {
      alert(`Rejection failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <>
        <Breadcrumb items={['Transactions', 'All Pendings', 'Detail']} />
        <Card title="Deposit Details">
          <div className="text-center py-8 text-slate-400">Loading deposit details...</div>
        </Card>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <Breadcrumb items={['Transactions', 'All Pendings', 'Detail']} />
        <Card title="Deposit Details">
          <div className="text-center py-8 text-rose-400">
            {error || 'Deposit not found'}
          </div>
          <div className="flex justify-center mt-4">
            <button
              onClick={() => navigate('/all-pendings')}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
            >
              ← Back to All Pendings
            </button>
          </div>
        </Card>
      </>
    )
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || (typeof window !== 'undefined' ? `${window.location.protocol}//api.${window.location.hostname.replace(/^admin\./, '')}` : '')
  const screenshotUrl = data.screenshotPath
    ? (data.screenshotPath.startsWith('http') ? data.screenshotPath : `${apiBase}${data.screenshotPath}`)
    : null

  return (
    <>
      <Breadcrumb items={['Transactions', 'All Pendings', `Ref: ${data.referenceNumber || data.id}`]} />
      <Card
        title={`Deposit Details - ${data.referenceNumber || data.id}`}
        footer={`Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : '—'}`}
      >
        <div className="space-y-6">
          {/* User Information */}
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h3 className="text-lg font-semibold text-emerald-400 mb-3">User Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Name:</span>
                <span className="ml-2 text-slate-100">{data.userName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Email:</span>
                <span className="ml-2 text-slate-100">{data.userEmail || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Phone:</span>
                <span className="ml-2 text-slate-100">{data.userPhone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Country:</span>
                <span className="ml-2 text-slate-100">{data.userCountry || '—'}</span>
              </div>
            </div>
          </div>

          {/* Deposit Information */}
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h3 className="text-lg font-semibold text-emerald-400 mb-3">Deposit Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Reference Number:</span>
                <span className="ml-2 text-slate-100 font-mono">{data.referenceNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Amount:</span>
                <span className="ml-2 text-emerald-300 font-bold text-lg">
                  ${typeof data.amount === 'number' ? data.amount.toFixed(2) : data.amount}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Method:</span>
                <span className="ml-2 text-slate-100 uppercase">{data.paymentMethod || data.method || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Payment Chain:</span>
                <span className="ml-2 text-slate-100 uppercase">{data.paymentChain || data.cryptoChain || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                    data.status === 'pending'
                      ? 'bg-amber-900 text-amber-300'
                      : data.status === 'completed'
                      ? 'bg-emerald-900 text-emerald-300'
                      : data.status === 'rejected'
                      ? 'bg-rose-900 text-rose-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {data.status || '—'}
                </span>
              </div>
              {data.cryptoChain && (
                <div>
                  <span className="text-slate-400">Crypto Chain:</span>
                  <span className="ml-2 text-slate-100">{data.cryptoChain}</span>
                </div>
              )}
              {data.promoCode && (
                <div>
                  <span className="text-slate-400">Promo Code:</span>
                  <span className="ml-2 text-emerald-300">{data.promoCode}</span>
                </div>
              )}
              {(data.promoDiscountPercent || data.promoDiscountPercent === 0) && (
                <div>
                  <span className="text-slate-400">Promo Discount:</span>
                  <span className="ml-2 text-emerald-300">{Number(data.promoDiscountPercent || 0)}%</span>
                </div>
              )}
              {data.cryptoAddress && (
                <div className="md:col-span-2">
                  <span className="text-slate-400">Crypto Address:</span>
                  <span className="ml-2 text-slate-100 font-mono text-xs break-all">{data.cryptoAddress}</span>
                </div>
              )}
              {data.remarks && (
                <div className="md:col-span-2">
                  <span className="text-slate-400">Remarks:</span>
                  <p className="mt-1 text-slate-100 whitespace-pre-wrap">{data.remarks}</p>
                </div>
              )}
              {data.notes && (
                <div className="md:col-span-2">
                  <span className="text-slate-400">Notes:</span>
                  <p className="mt-1 text-slate-100 whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          {screenshotUrl && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-lg font-semibold text-emerald-400 mb-3">Payment Screenshot</h3>
              <div className="flex justify-center">
                <img
                  src={screenshotUrl}
                  alt="Deposit Screenshot"
                  className="max-w-full max-h-[600px] rounded border border-slate-600"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'block'
                  }}
                />
                <div className="hidden text-center text-slate-400 py-8">
                  Screenshot not available
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {data.status === 'pending' && (
            <div className="flex gap-3 justify-center pt-4 border-t border-slate-700">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span
                  className="align-middle"
                  style={{
                    fontFamily: 'Material Symbols Outlined',
                    fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24",
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  check_circle
                </span>
                {processing ? 'Processing...' : 'Approve Deposit'}
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span
                  className="align-middle"
                  style={{
                    fontFamily: 'Material Symbols Outlined',
                    fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24",
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  cancel
                </span>
                {processing ? 'Processing...' : 'Reject Deposit'}
              </button>
            </div>
          )}

          {/* Back Button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => navigate('/all-pendings')}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
            >
              ← Back to All Pendings
            </button>
          </div>
        </div>
      </Card>
    </>
  )
}
