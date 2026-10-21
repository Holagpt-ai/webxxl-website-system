'use client'

import { AlertCircle, ChevronLeft, ChevronRight, Lock, LogIn, PauseCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CommerceApiError, CommerceUiErrorCode } from '@/lib/commerce-ui/client'
import { fill } from '@/lib/commerce-ui/format'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { cn } from '@/lib/utils'

const STATE_ICONS: Record<CommerceUiErrorCode, typeof AlertCircle> = {
  COMMERCE_DISABLED: PauseCircle,
  UNAUTHORIZED: LogIn,
  FORBIDDEN: Lock,
  POLICY_UNRESOLVED: ShieldAlert,
  VALIDATION: AlertCircle,
  PRICE_UNAVAILABLE: AlertCircle,
  ACCOUNT_NOT_FUNDED: AlertCircle,
  UNKNOWN: AlertCircle,
}

export function CommerceState({
  error,
  code,
  copy,
  compact,
  onRetry,
  loginHref,
}: {
  error?: CommerceApiError
  code?: CommerceUiErrorCode
  copy: CommerceCopy
  compact?: boolean
  onRetry?: () => void
  loginHref?: string
}) {
  const resolved = code ?? error?.code ?? 'UNKNOWN'
  const state = copy.states[resolved]
  const Icon = STATE_ICONS[resolved]
  const retryable = resolved === 'UNKNOWN' && onRetry

  if (compact) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">{state.title}.</span> {state.body}
        </span>
      </p>
    )
  }

  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{state.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
      </div>
      {retryable && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {copy.common.retry}
        </Button>
      )}
      {resolved === 'UNAUTHORIZED' && loginHref && (
        <Button size="sm" render={<a href={loginHref} />}>
          <LogIn className="size-4" aria-hidden="true" />
          {copy.states.UNAUTHORIZED.title}
        </Button>
      )}
    </div>
  )
}

export type PillTone = 'neutral' | 'success' | 'info' | 'danger' | 'muted'

const TONES: Record<PillTone, string> = {
  neutral: 'border-border bg-card text-foreground',
  success: 'border-transparent bg-success/15 text-success',
  info: 'border-transparent bg-secondary text-secondary-foreground',
  danger: 'border-transparent bg-destructive/10 text-destructive',
  muted: 'border-dashed border-border bg-muted text-muted-foreground',
}

export function StatusPill({ label, tone = 'neutral', className }: { label: string; tone?: PillTone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}

export function orderTone(status: string): PillTone {
  if (status === 'FULFILLED' || status === 'PAID') return 'success'
  if (status === 'FAILED' || status === 'FULFILLMENT_BLOCKED' || status === 'CANCELLED') return 'danger'
  if (status === 'REFUNDED') return 'muted'
  return 'info'
}

export function activationTone(status: string): PillTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DRAFT') return 'muted'
  return 'neutral'
}

export function Section({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      ))}
    </div>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function Pagination({
  total,
  take,
  skip,
  onChange,
  copy,
}: {
  total: number
  take: number
  skip: number
  onChange: (skip: number) => void
  copy: CommerceCopy
}) {
  if (total <= take) return null
  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + take, total)
  return (
    <nav aria-label={copy.pagination.label} className="flex items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fill(copy.pagination.range, { from, to, total })}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={skip === 0} onClick={() => onChange(Math.max(0, skip - take))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {copy.pagination.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={skip + take >= total} onClick={() => onChange(skip + take)}>
          {copy.pagination.next}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}

/** Wraps wide tables so they scroll horizontally on small screens instead of overflowing the page. */
export function TableFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="-mx-5 overflow-x-auto md:mx-0" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export const th = 'border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pl-5 md:first:pl-3'
export const td = 'border-b px-3 py-3 align-top first:pl-5 md:first:pl-3'
