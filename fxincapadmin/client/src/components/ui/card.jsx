import React from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }) {
  return <div className={cn('rounded-xl border border-slate-700 bg-slate-900/60 text-slate-100', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('p-5 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 pt-2', className)} {...props} />
}
