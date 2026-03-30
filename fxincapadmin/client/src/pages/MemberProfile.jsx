import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import { useAuth } from '../context/AuthContext'

const API_URL = (import.meta.env.VITE_API_URL ?? '').trim()

const InfoField = ({ label, value }) => (
  <div className="mb-6 pb-4 border-b border-slate-700 last:border-b-0">
    <div className="text-sm font-medium text-slate-400 mb-1">{label}</div>
    <div className="text-lg text-slate-100">{value || '—'}</div>
  </div>
)

export const MemberProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!id) {
      setMember(null)
      setLoading(false)
      return
    }

    const fetchMemberDetails = async () => {
      setLoading(true)
      setError('')
      setNotice('')
      try {
        const resp = await fetch(`${API_URL}/api/admin/users/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body?.error || `Request failed with ${resp.status}`)
        }

        const json = await resp.json()
        setMember(json?.data || null)
      } catch (err) {
        setError(err?.message || 'Failed to load member details')
      } finally {
        setLoading(false)
      }
    }

    fetchMemberDetails()
  }, [id])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    setError('')
    setSearchResults([])

    try {
      const params = new URLSearchParams({ limit: '10', page: '1', search: searchQuery })
      const resp = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body?.error || `Request failed with ${resp.status}`)
      }

      const json = await resp.json()
      const data = Array.isArray(json?.data) ? json.data : []
      setSearchResults(data)

      if (data.length === 0) {
        setError('No members found matching your search')
      }
    } catch (err) {
      setError(err?.message || 'Failed to search members')
    } finally {
      setSearching(false)
    }
  }

  const handleDelete = async () => {
    if (!member?.id || deleteLoading) return

    setDeleteLoading(true)
    setError('')
    setNotice('')

    try {
      const resp = await fetch(`${API_URL}/api/admin/users/${member.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || `Request failed with ${resp.status}`)
      }

      setNotice(json?.message || 'User deleted successfully')
      setDeleteDialogOpen(false)
      navigate('/members/list')
    } catch (err) {
      setError(err?.message || 'Failed to delete user')
    } finally {
      setDeleteLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-emerald-300'
      case 'pending':
        return 'text-amber-300'
      case 'blocked':
        return 'text-rose-300'
      default:
        return 'text-slate-400'
    }
  }

  const getEmailVerifiedColor = (verified) => {
    return verified ? 'text-emerald-300' : 'text-amber-300'
  }

  const formatCurrency = (amount) => {
    const numericAmount = Number(amount || 0)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount)
  }

  const deleteAssessment = member?.deletionAssessment || null
  const tradeHistoryLabel = deleteAssessment?.tradeCount > 0
    ? `${deleteAssessment.tradeCount} trade${deleteAssessment.tradeCount === 1 ? '' : 's'}`
    : 'No trades'

  return (
    <>
      <Breadcrumb items={['Members', 'Member Profile']} />
      
      {/* Show search interface if no ID is provided */}
      {!id ? (
        <Card
          title="Search Member Profile"
          footer={error ? `Error: ${error}` : searching ? 'Searching...' : 'Enter member name or email to search'}
        >
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search by name or email..."
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!searchQuery.trim() || searching}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-3 text-base font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Search Results ({searchResults.length})</h3>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex-1">
                    <div className="text-base font-semibold text-slate-100">
                      {result.firstName} {result.lastName}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">{result.email}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {result.phone && `Phone: ${result.phone} • `}
                      Status: <span className={result.status === 'active' ? 'text-emerald-300' : result.status === 'pending' ? 'text-amber-300' : 'text-rose-300'}>{result.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/members/profile/${result.id}`)}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 transition-colors"
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !searching && searchQuery && (
            <div className="text-center text-slate-400 py-8">
              No members found. Try searching with a different name or email.
            </div>
          )}
        </Card>
      ) : (
        // Show member details if ID is provided
        <Card
          title="Member Details"
          footer={error ? `Error: ${error}` : notice ? notice : loading ? 'Loading...' : 'Member Profile'}
        >
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading member details...</div>
          ) : error ? (
            <div className="text-center text-rose-400 py-8">{error}</div>
          ) : member ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Personal Information</h3>
                <InfoField
                  label="First Name"
                  value={member.firstName}
                />
                <InfoField
                  label="Last Name"
                  value={member.lastName}
                />
                <InfoField
                  label="Email"
                  value={member.email}
                />
                <InfoField
                  label="Phone"
                  value={member.phone}
                />
                <InfoField
                  label="Country Code"
                  value={member.countryCode}
                />
              </div>

              {/* Right Column */}
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Account Status</h3>
                <div className="mb-6 pb-4 border-b border-slate-700">
                  <div className="text-sm font-medium text-slate-400 mb-1">Status</div>
                  <div className={`text-lg font-semibold ${getStatusColor(member.status)}`}>
                    {member.status || '—'}
                  </div>
                </div>
                <div className="mb-6 pb-4 border-b border-slate-700">
                  <div className="text-sm font-medium text-slate-400 mb-1">Email Verified</div>
                  <div className={`text-lg font-semibold ${getEmailVerifiedColor(member.emailVerified)}`}>
                    {member.emailVerified ? 'Verified' : 'Pending'}
                  </div>
                </div>
                <div className="mb-6 pb-4 border-b border-slate-700">
                  <div className="text-sm font-medium text-slate-400 mb-1">Delete Eligibility</div>
                  <div className={`text-lg font-semibold ${member?.deletionAssessment?.canDelete ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {member?.deletionAssessment?.canDelete ? 'Can be deleted' : 'Protected'}
                  </div>
                  {member?.deletionAssessment?.reason ? (
                    <p className="mt-2 text-sm text-slate-400">{member.deletionAssessment.reason}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">No trades and no wallet balance detected.</p>
                  )}
                </div>
                <InfoField
                  label="Member ID"
                  value={member.id}
                />
                <InfoField
                  label="Created Date"
                  value={formatDate(member.createdAt)}
                />
                <InfoField
                  label="Updated Date"
                  value={formatDate(member.updatedAt)}
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">No member found</div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-700 flex gap-3">
            <button
              onClick={() => navigate('/members/list')}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors"
            >
              ← Back to List
            </button>
            <button
              onClick={() => navigate('/members/profile')}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors"
            >
              🔍 Search Another
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 transition-colors"
              disabled
            >
              Edit Member
            </button>
            <button
              onClick={() => {
                setError('')
                setNotice('')
                setDeleteDialogOpen(true)
              }}
              disabled={deleteLoading || !member}
              className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteLoading ? 'Deleting...' : 'Delete Member'}
            </button>
          </div>

          {deleteDialogOpen && member ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
              <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <h3 className="text-xl font-semibold text-slate-100">Delete Member</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Review this account status before deleting {member.email}.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Email verified</div>
                    <div className={`mt-1 text-base font-semibold ${getEmailVerifiedColor(member.emailVerified)}`}>
                      {member.emailVerified ? 'Verified' : 'Pending'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Trade history</div>
                    <div className={`mt-1 text-base font-semibold ${deleteAssessment?.tradeCount > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {tradeHistoryLabel}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Real wallet balance</div>
                    <div className={`mt-1 text-base font-semibold ${Number(deleteAssessment?.totalWalletBalance || 0) > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {formatCurrency(deleteAssessment?.totalWalletBalance || 0)}
                    </div>
                  </div>
                </div>

                {deleteAssessment?.reason ? (
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {deleteAssessment.reason}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    This user will be fully deleted from the system after confirmation.
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleteLoading}
                    className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteLoading || !deleteAssessment?.canDelete}
                    className="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteLoading ? 'Deleting...' : 'Accept and Delete'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </>
  )
}
