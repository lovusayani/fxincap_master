import React from 'react'
import { cn } from '../../lib/utils'

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
