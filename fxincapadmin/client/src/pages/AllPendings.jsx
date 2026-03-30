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


const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A'
  const date = new Date(dateValue)
  if (isNaN(date.getTime())) return 'Invalid Date'
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const PendingsTable = ({ rows, columns, type }) => {
  const [sorting, setSorting] = useState([])
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <>
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
              <TableCell className="text-center text-slate-400" colSpan={12}>
                No pending {type} requests found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableCaption>
          Showing {rows.length} pending {type} request{rows.length === 1 ? '' : 's'}
        </TableCaption>
      </Table>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          {Array.from({ length: Math.max(1, table.getPageCount()) }).map((_, i) => (
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
    </>
  )
}

export const AllPendings = () => {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [depositRows, setDepositRows] = useState([])
  const [withdrawalRows, setWithdrawalRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const depositColumns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'Request ID',
        cell: (info) => `#${info.getValue()?.slice(0, 8).toUpperCase()}`,
      },
      {
        accessorKey: 'userId',
        header: 'User ID',
        cell: (info) => `#${info.getValue()}`,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: (info) => `$${parseFloat(info.getValue() || 0).toFixed(2)}`,
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Payment',
        cell: (info) => info.getValue() || '—',
      },
      {
        accessorKey: 'paymentChain',
        header: 'Chain',
        cell: (info) => info.getValue() || '—',
      },
      {
        accessorKey: 'promoCode',
        header: 'Promo',
        cell: (info) => info.getValue() || '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => (
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
              info.getValue() === 'pending'
                ? 'bg-yellow-900/30 text-yellow-200'
                : info.getValue() === 'completed'
                  ? 'bg-emerald-900/30 text-emerald-200'
                  : 'bg-red-900/30 text-red-200'
            }`}
          >
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Submitted',
        cell: (info) => formatDate(info.getValue()),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: (info) => (
          <button
            onClick={() => navigate(`/pending-deposit/${info.row.original.id}`)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              visibility
            </span>
            View
          </button>
        ),
      },
    ],
    [navigate]
  )

  const withdrawalColumns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'Request ID',
        cell: (info) => `#${info.getValue()?.slice(0, 8).toUpperCase()}`,
      },
      {
        accessorKey: 'userId',
        header: 'User ID',
        cell: (info) => `#${info.getValue()}`,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: (info) => `$${parseFloat(info.getValue() || 0).toFixed(2)}`,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => (
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
              info.getValue() === 'pending'
                ? 'bg-yellow-900/30 text-yellow-200'
                : info.getValue() === 'completed'
                  ? 'bg-blue-900/30 text-blue-200'
                  : 'bg-red-900/30 text-red-200'
            }`}
          >
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Submitted',
        cell: (info) => formatDate(info.getValue()),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: (info) => (
          <button
            onClick={() => navigate(`/pending-withdrawal/${info.row.original.id}`)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              visibility
            </span>
            View
          </button>
        ),
      },
    ],
    [navigate]
  )

  useEffect(() => {
    const controller = new AbortController()
    const fetchPendings = async () => {
      setLoading(true)
      setError('')
      try {
        // Fetch deposits and withdrawals in parallel
        const [depositsRes, withdrawalsRes] = await Promise.all([
          fetch(`/api/admin/funds?status=pending&type=deposit`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          }),
          fetch(`/api/admin/funds?status=pending&type=withdrawal`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          }),
        ])

        if (!depositsRes.ok || !withdrawalsRes.ok) {
          throw new Error('Failed to fetch pending requests')
        }

        const depositsData = await depositsRes.json()
        const withdrawalsData = await withdrawalsRes.json()

        setDepositRows(depositsData.data || [])
        setWithdrawalRows(withdrawalsData.data || [])
      } catch (err) {
        if (err?.name === 'AbortError') return
        console.error('Error fetching pendings:', err)
        setError(err.message || 'Failed to fetch pending requests')
      } finally {
        setLoading(false)
      }
    }

    fetchPendings()
    return () => controller.abort()
  }, [token])

  return (
    <>
      <Breadcrumb items={['Transactions', 'All Pendings']} />
      <Card
        title="All Pending Requests"
        footer={
          error
            ? `Error: ${error}`
            : loading
              ? 'Loading pending requests...'
              : `Total Deposits: ${depositRows.length} | Total Withdrawals: ${withdrawalRows.length}`
        }
      >
        {/* Pending Deposits Section */}
        <div className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-emerald-400">
            📥 All Pending Deposits
          </h2>
          <PendingsTable rows={depositRows} columns={depositColumns} type="deposit" />
        </div>

        {/* Pending Withdrawals Section */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-blue-400">
            📤 All Pending Withdrawals
          </h2>
          <PendingsTable rows={withdrawalRows} columns={withdrawalColumns} type="withdrawal" />
        </div>
      </Card>
    </>
  )
}
