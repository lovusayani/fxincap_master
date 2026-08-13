import React, { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption,
} from '../components/ui/table'
import {
  useReactTable, getCoreRowModel, flexRender,
  getPaginationRowModel, getSortedRowModel,
} from '@tanstack/react-table'
import { useAuth } from '../context/AuthContext'

export const SubAgentsList = () => {
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState([])
  const [total, setTotal] = useState(0)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({
          limit: String(pagination.pageSize),
          page: String(pagination.pageIndex + 1),
        })
        if (search) params.set('search', search)
        const resp = await fetch(`/api/admin/sub-agents?${params}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: controller.signal,
        })
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body?.error || `Request failed: ${resp.status}`)
        }
        const json = await resp.json()
        setRows((json.data || []).map(item => ({
          id: item.id,
          name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || '—',
          email: item.email || '—',
          status: item.status || '—',
          emailVerified: item.emailVerified ? 'Verified' : 'Pending',
          lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never',
          createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—',
        })))
        setTotal(Number(json.total || 0))
      } catch (err) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Failed to load sub agents')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [search, pagination.pageIndex, pagination.pageSize, token])

  const columns = useMemo(() => [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: info => {
        const v = info.getValue()
        const cls =
          v === 'active' ? 'text-emerald-300' :
          v === 'banned' ? 'text-rose-400' :
          v === 'suspended' ? 'text-amber-300' : 'text-slate-400'
        return <span className={cls}>{v}</span>
      },
    },
    {
      header: 'Email Verified',
      accessorKey: 'emailVerified',
      cell: info => {
        const v = info.getValue()
        return <span className={v === 'Verified' ? 'text-emerald-300' : 'text-amber-300'}>{v}</span>
      },
    },
    { header: 'Last Login', accessorKey: 'lastLoginAt' },
    { header: 'Joined on', accessorKey: 'createdAt' },
  ], [])

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  return (
    <>
      <Breadcrumb items={['Members', 'Sub Agents']} />

      <Card
        title="Sub Agents"
        footer={
          error ? `Error: ${error}` :
          loading ? 'Loading...' :
          `Total: ${total} agent${total === 1 ? '' : 's'} | Page ${pagination.pageIndex + 1} of ${pageCount}`
        }
      >
        <div className="mb-4">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })) }}
            placeholder="🔍 Search by name or email..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-400">
                  {loading ? 'Loading...' : error ? 'Failed to load' : 'No sub agents found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableCaption>Source: /api/admin/sub-agents | Total: {total}</TableCaption>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1}–{Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >← Previous</button>
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={`rounded-md px-3 py-2 text-sm ${pagination.pageIndex === i ? 'bg-emerald-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'}`}
              >{i + 1}</button>
            ))}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >Next →</button>
          </div>
        </div>
      </Card>
    </>
  )
}
