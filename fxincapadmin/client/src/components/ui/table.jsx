import * as React from 'react'
import { cn } from '../../lib/utils'

export const Table = React.forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm text-left text-slate-200', className)}
        {...props}
      />
    </div>
  )
})

export const TableHeader = React.forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('border-b border-slate-800 text-slate-300', className)} {...props} />
})

export const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn(className)} {...props} />
})

export const TableFooter = React.forwardRef(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn('bg-slate-900/60 font-medium text-slate-200', className)}
      {...props}
    />
  )
})

export const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-slate-800 transition-colors hover:bg-slate-800/60',
        className
      )}
      {...props}
    />
  )
})

export const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        'px-3 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 align-middle',
        className
      )}
      {...props}
    />
  )
})

export const TableCell = React.forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn('px-3 py-2 align-middle', className)} {...props} />
})

export const TableCaption = React.forwardRef(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-sm text-slate-500 text-left', className)}
      {...props}
    />
  )
})
