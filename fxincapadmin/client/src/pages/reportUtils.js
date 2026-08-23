// Shared helpers for the Reports pages.

export const money = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const compactMoney = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}

export const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export const fmtDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export const statusTone = (status) => {
  const v = String(status || '').toLowerCase()
  if (v === 'completed' || v === 'approved') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  if (v === 'rejected' || v === 'failed') return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
}

/** Download rows as CSV without pulling in a spreadsheet library. */
export const downloadCsv = (filename, columns, rows) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    columns.map((c) => escape(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escape(c.value(row))).join(',')),
  ].join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Default window: last 30 days, as YYYY-MM-DD. */
export const defaultRange = () => {
  const today = new Date()
  const past = new Date(today)
  past.setDate(past.getDate() - 29)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { from: iso(past), to: iso(today) }
}
