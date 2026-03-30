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

export const PendingWithdrawalDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [withdrawal, setWithdrawal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchWithdrawalDetail = async () => {
      if (!token || !id) return
      setLoading(true)
      setError('')
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.suimfx.com'
        const res = await fetch(`${apiBase}/api/admin/funds/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData?.error || 'Failed to fetch withdrawal details')
        }

        const data = await res.json()
        setWithdrawal(data.data)
      } catch (err) {
        console.error('Error fetching withdrawal:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchWithdrawalDetail()
  }, [id, token])

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this withdrawal request?')) return

    setActionLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.suimfx.com'
      const res = await fetch(`${apiBase}/api/admin/funds/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Failed to approve withdrawal')
      }

      const responseData = await res.json()
      alert(`Withdrawal approved! Account: ${responseData.accountId}`)
      navigate('/all-pendings')
    } catch (err) {
      console.error('Error approving withdrawal:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this withdrawal request?')) return

    setActionLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.suimfx.com'
      const res = await fetch(`${apiBase}/api/admin/funds/${id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Failed to reject withdrawal')
      }

      alert('Withdrawal request rejected')
      navigate('/all-pendings')
    } catch (err) {
      console.error('Error rejecting withdrawal:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Breadcrumb items={['Transactions', 'All Pendings', 'Withdrawal Details']} />
        <Card title="Withdrawal Request Details">
          <div className="text-center text-slate-400">Loading withdrawal details...</div>
        </Card>
      </>
    )
  }

  if (error || !withdrawal) {
    return (
      <>
        <Breadcrumb items={['Transactions', 'All Pendings', 'Withdrawal Details']} />
        <Card title="Withdrawal Request Details">
          <div className="text-red-400">{error || 'Withdrawal not found'}</div>
          <button
            onClick={() => navigate('/all-pendings')}
            className="mt-4 rounded-md bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
          >
            ← Back to All Pendings
          </button>
        </Card>
      </>
    )
  }

  return (
    <>
      <Breadcrumb items={['Transactions', 'All Pendings', 'Withdrawal Details']} />
      <Card title="Withdrawal Request Details">
        <div className="grid gap-8">
          {/* User Information Section */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">User Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">User ID:</span>
                  <span className="text-white">#{withdrawal.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white">{withdrawal.userEmail || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="text-white">{withdrawal.userName || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Withdrawal Information Section */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">Withdrawal Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Request ID:</span>
                  <span className="text-white">#{withdrawal.id?.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white">${parseFloat(withdrawal.amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      withdrawal.status === 'pending'
                        ? 'bg-yellow-900/30 text-yellow-200'
                        : withdrawal.status === 'approved'
                          ? 'bg-blue-900/30 text-blue-200'
                          : 'bg-red-900/30 text-red-200'
                    }`}
                  >
                    {withdrawal.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Submitted:</span>
                  <span className="text-white">
                    {new Date(withdrawal.created_at).toLocaleDateString()}{' '}
                    {new Date(withdrawal.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-300">Additional Information</h3>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white capitalize">{withdrawal.type || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method:</span>
                <span className="text-white">{withdrawal.method || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Address:</span>
                <span className="truncate text-white">{withdrawal.accountAddress || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Network:</span>
                <span className="text-white">{withdrawal.network || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Notes (if available) */}
          {withdrawal.notes && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Admin Notes</h3>
              <p className="text-sm text-slate-300">{withdrawal.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          {withdrawal.status === 'pending' && (
            <div className="flex gap-4 border-t border-slate-700 pt-6">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Processing...' : '✓ Approve Withdrawal'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 rounded-md bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Processing...' : '✕ Reject Withdrawal'}
              </button>
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={() => navigate('/all-pendings')}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 hover:bg-slate-800"
          >
            ← Back to All Pendings
          </button>
        </div>
      </Card>
    </>
  )
}
