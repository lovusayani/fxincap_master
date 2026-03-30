import React, { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '../components/ui/table'
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table'
import { useAuth } from '../context/AuthContext'

const formatDate = (value) => {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Invalid Date'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
}

const Modal = ({ doc, onClose, onApprove, onReject, fileUrl }) => {
  if (!doc) return null

  const isImage = fileUrl && /(png|jpg|jpeg|gif|webp)$/i.test(fileUrl.split('.').pop() || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-lg font-semibold text-white">KYC Document</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex justify-between"><span className="text-slate-400">User:</span><span>{doc.userName || doc.userEmail || `#${doc.userId}`}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Document:</span><span>{doc.documentType || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Status:</span><span className={`rounded-full px-3 py-1 text-xs capitalize ${doc.status === 'pending' ? 'bg-yellow-900/40 text-yellow-200' : doc.status === 'approved' ? 'bg-emerald-900/40 text-emerald-200' : 'bg-red-900/40 text-red-200'}`}>{doc.status}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Submitted:</span><span>{formatDate(doc.createdAt)}</span></div>
            {doc.notes && <div className="text-slate-300">Notes: {doc.notes}</div>}
          </div>
          <div className="flex min-h-[240px] items-center justify-center rounded-md border border-slate-700 bg-slate-950 p-3">
            {fileUrl ? (
              isImage ? <img src={fileUrl} alt="KYC" className="max-h-72 w-full rounded object-contain" /> : <a href={fileUrl} target="_blank" rel="noreferrer" className="text-emerald-400 underline">Open document</a>
            ) : (
              <span className="text-slate-500">No document available</span>
            )}
          </div>
        </div>
        {doc.status === 'pending' && (
          <div className="flex gap-3 border-t border-slate-700 px-4 py-3">
            <button onClick={onApprove} className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">Approve</button>
            <button onClick={onReject} className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700">Reject</button>
          </div>
        )}
      </div>
    </div>
  )
}

export const UserKycStatus = () => {
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalDoc, setModalDoc] = useState(null)

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.suimfx.com'

  const buildFileUrl = (fileUrl) => {
    if (!fileUrl) return null
    if (fileUrl.startsWith('http')) return fileUrl
    if (fileUrl.startsWith('/')) return `${apiBase}${fileUrl}`
    return `${apiBase}/uploads/${fileUrl}`
  }

  const fetchDocs = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100', page: '1' })
      if (search) params.set('search', search)
      const res = await fetch(`${apiBase}/api/admin/kyc-documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load KYC documents')
      }
      const data = await res.json()
      setRows(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this KYC document?')) return
    await updateStatus(id, 'approve')
  }

  const handleReject = async (id) => {
    if (!window.confirm('Reject this KYC document?')) return
    await updateStatus(id, 'reject')
  }

  const updateStatus = async (id, action) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/kyc-documents/${id}/${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Update failed')
      }
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r))
      if (modalDoc?.id === id) setModalDoc(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : null)
    } catch (err) {
      alert(err.message)
    }
  }

  const columns = useMemo(() => [
    {
      header: 'ID',
      accessorKey: 'id',
      cell: info => `#${info.getValue()?.slice(0,8).toUpperCase()}`,
    },
    {
      header: 'User',
      accessorKey: 'userEmail',
      cell: info => {
        const row = info.row.original
        return row.userName || row.userEmail || `#${row.userId}`
      },
    },
    {
      header: 'Document',
      accessorKey: 'documentType',
      cell: info => info.getValue() || '—',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => {
        const val = info.getValue()
        const cls = val === 'pending' ? 'bg-yellow-900/40 text-yellow-200' : val === 'approved' ? 'bg-emerald-900/40 text-emerald-200' : 'bg-red-900/40 text-red-200'
        return <span className={`rounded-full px-3 py-1 text-xs capitalize ${cls}`}>{val}</span>
      },
    },
    {
      header: 'Submitted',
      accessorKey: 'createdAt',
      cell: info => formatDate(info.getValue()),
    },
    {
      header: 'Action',
      id: 'actions',
      cell: info => {
        const row = info.row.original
        const fileUrl = buildFileUrl(row.fileUrl)
        return (
          <div className="flex gap-2">
            <button
              onClick={() => setModalDoc(row)}
              className="rounded-md bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-600"
            >
              View
            </button>
            {row.status === 'pending' && (
              <>
                <button
                  onClick={() => handleApprove(row.id)}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(row.id)}
                  className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {},
    initialState: { pagination: { pageSize: 10 } },
  })

  const activeFileUrl = buildFileUrl(modalDoc?.fileUrl || '')

  return (
    <>
      <Breadcrumb items={['KYC', 'User KYC Status']} />
      <Card
        title="User KYC Status"
        footer={error ? `Error: ${error}` : loading ? 'Loading KYC documents...' : `${rows.length} document(s)`}
      >
        {error && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </div>
        )}
        <div className="mb-4 flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, name, document type"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={fetchDocs}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          >
            Search
          </button>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className={header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-slate-700' : ''} onClick={header.column.getToggleSortingHandler()}>
                    <div className="flex items-center gap-2">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-xs">
                          {header.column.getIsSorted() === 'asc' && ' ↑'}
                          {header.column.getIsSorted() === 'desc' && ' ↓'}
                          {!header.column.getIsSorted() && ' ⇅'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-400">
                  {loading ? 'Loading...' : 'No KYC documents found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableCaption>{rows.length} KYC document{rows.length === 1 ? '' : 's'}</TableCaption>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </div>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">← Previous</button>
            {Array.from({ length: Math.max(1, table.getPageCount()) }).map((_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={`rounded-md px-2 py-2 text-sm ${table.getState().pagination.pageIndex === i ? 'bg-emerald-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'}`}
              >
                {i + 1}
              </button>
            ))}
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next →</button>
          </div>
        </div>
      </Card>

      <Modal
        doc={modalDoc}
        fileUrl={activeFileUrl}
        onClose={() => setModalDoc(null)}
        onApprove={() => modalDoc && handleApprove(modalDoc.id)}
        onReject={() => modalDoc && handleReject(modalDoc.id)}
      />
    </>
  )
}
