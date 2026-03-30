import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useReactTable, getCoreRowModel, flexRender, getPaginationRowModel, getSortedRowModel } from '@tanstack/react-table'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'

export const MemberList = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState([])
  const [total, setTotal] = useState(0)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchUsers = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({
          limit: String(pagination.pageSize),
          page: String(pagination.pageIndex + 1),
        })
        if (search) params.set('search', search)
        const resp = await fetch(`/api/admin/users?${params.toString()}`, {
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
        const data = Array.isArray(json?.data) ? json.data : []
        const totalCount = Number(json?.total || 0)
        setRows(
          data.map(item => ({
            id: item.id,
            name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || '—',
            email: item.email || '—',
            phone: item.phone || '—',
            emailVerified: item.emailVerified ? 'Verified' : 'Pending',
            country: item.countryCode || '—',
            status: item.status || '—',
            createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : '—',
          }))
        )
        setTotal(totalCount)
      } catch (err) {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
    return () => controller.abort()
  }, [search, pagination.pageIndex, pagination.pageSize, token])

  const columns = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Email',
        accessorKey: 'email',
      },
      {
        header: 'Phone',
        accessorKey: 'phone',
      },
      {
        header: 'Email Verified',
        accessorKey: 'emailVerified',
        cell: info => {
          const value = info.getValue()
          const color = value === 'Verified' ? 'text-emerald-300' : 'text-amber-300'
          return <span className={color}>{value}</span>
        },
      },
      {
        header: 'Country',
        accessorKey: 'country',
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: info => {
          const value = info.getValue()
          const color = value === 'active' ? 'text-emerald-300' : value === 'pending' ? 'text-amber-300' : value === 'blocked' ? 'text-rose-300' : 'text-slate-400'
          return <span className={color}>{value || '—'}</span>
        },
      },
      {
        header: 'Created',
        accessorKey: 'createdAt',
      },
      {
        header: 'Action',
        id: 'action',
        cell: info => {
          const memberId = info.row.original.id
          return (
            <button
              onClick={() => navigate(`/members/profile/${memberId}`)}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 transition-colors"
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
                visibility
              </span>
              View
            </button>
          )
        },
      },
    ],
    [navigate]
  )

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      setError('')

      const limit = 200
      let page = 1
      let collected = []
      let expectedTotal = 0

      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          page: String(page),
        })
        if (search) params.set('search', search)

        const resp = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body?.error || `Export request failed with ${resp.status}`)
        }

        const json = await resp.json()
        const batch = Array.isArray(json?.data) ? json.data : []
        expectedTotal = Number(json?.total || 0)
        collected = collected.concat(batch)

        if (batch.length < limit || collected.length >= expectedTotal) break
        page += 1
      }

      const exportRows = collected.map(item => ({
        ID: item.id,
        Name: `${item.firstName || ''} ${item.lastName || ''}`.trim(),
        Email: item.email || '',
        Phone: item.phone || '',
        EmailVerified: item.emailVerified ? 'Verified' : 'Pending',
        Country: item.countryCode || '',
        Status: item.status || '',
        CreatedAt: item.createdAt ? new Date(item.createdAt).toISOString() : '',
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(exportRows)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Members')

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      XLSX.writeFile(workbook, `members-${stamp}.xlsx`)
    } catch (err) {
      setError(err?.message || 'Failed to export users')
    } finally {
      setExporting(false)
    }
  }

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  return (
    <>
      <Breadcrumb items={["Members", "Member List"]} />
      <Card
        title="Member List"
        footer={
          error
            ? `Error: ${error}`
            : loading
            ? 'Loading users...'
            : `Total: ${rows.length} user${rows.length === 1 ? '' : 's'} | Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`
        }
      >
        {/* Search Bar */}
        <div className="mb-4 flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search by name, email, phone..."
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead 
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-slate-700' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-center text-slate-400" colSpan={columns.length}>
                  {loading ? 'Loading users...' : error ? 'Failed to load users' : 'No data found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableCaption>
            Source: /api/admin/users | Total: {total}
          </TableCaption>
        </Table>

        {/* Pagination Controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {rows.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1} to {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={`rounded-md px-2 py-2 text-sm ${
                  table.getState().pagination.pageIndex === i
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </Card>
    </>
  )
}
