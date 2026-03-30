import React, { useEffect, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { useAuth } from '../context/AuthContext'

export const Wallet = () => {
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const [selectedUser, setSelectedUser] = useState(null)
  const [nextBalance, setNextBalance] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchWalletRows = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search.trim()) params.set('search', search.trim())

      const resp = await fetch(`/api/admin/wallet-report?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      })

      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to fetch wallet report')
      }

      setRows(Array.isArray(json.data) ? json.data : [])
      setTotal(Number(json.total || 0))
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Failed to fetch wallet report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchWalletRows(controller.signal)
    return () => controller.abort()
  }, [token, page, limit, search])

  const openEditModal = (user) => {
    setSelectedUser(user)
    setNextBalance(String(Number(user.realBalance || 0).toFixed(2)))
  }

  const closeEditModal = () => {
    setSelectedUser(null)
    setNextBalance('')
  }

  const handleSaveBalance = async () => {
    if (!selectedUser) return
    const parsedBalance = Number(nextBalance)
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setError('Balance must be a non-negative number')
      return
    }

    try {
      setUpdating(true)
      setError('')
      const resp = await fetch(`/api/admin/wallet-report/${selectedUser.id}/balance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ balance: parsedBalance }),
      })

      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to update wallet balance')
      }

      closeEditModal()
      await fetchWalletRows()
    } catch (err) {
      setError(err?.message || 'Failed to update wallet balance')
    } finally {
      setUpdating(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <>
      <Breadcrumb items={['Transactions', 'Wallet']} />
      <Card
        title="Wallet"
        footer={
          error
            ? `Error: ${error}`
            : loading
              ? 'Loading wallet report...'
              : `Total users: ${total}`
        }
      >
        <div className="mb-4 flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="Search by user id, email, first name, or last name"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Equity</TableHead>
              <TableHead>Free Margin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name || row.id}</TableCell>
                  <TableCell>{row.email || '—'}</TableCell>
                  <TableCell>{row.accountNumber || 'Not Created'}</TableCell>
                  <TableCell>${Number(row.realBalance || 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(row.equity || 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(row.freeMargin || 0).toFixed(2)}</TableCell>
                  <TableCell>{row.status || 'active'}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => openEditModal(row)}
                      className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Edit Balance
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-400">
                  {loading ? 'Loading wallet report...' : 'No wallet records found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Page {page} of {pageCount}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-slate-100">Edit Real Balance</h3>
            <p className="mb-4 text-sm text-slate-400">User: {selectedUser.name || selectedUser.email || selectedUser.id}</p>

            <label className="mb-2 block text-sm text-slate-300">New Balance (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={nextBalance}
              onChange={(e) => setNextBalance(e.target.value)}
              className="mb-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBalance}
                disabled={updating}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
