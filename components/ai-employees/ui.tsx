'use client'

import { AlertCircle, ChevronLeft, ChevronRight, Lock, LogIn, PauseCircle, ShieldAlert, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PillTone } from '@/components/commerce/ui'
import type { AiApiError, AiErrorCode } from '@/lib/ai-employees-ui/client'
import { fill } from '@/lib/commerce-ui/format'
import type { AiEmployeesCopy } from '@/lib/i18n/dictionaries/ai-employees-en'
import { cn } from '@/lib/utils'

export { Section, StatusPill, LoadingRows, EmptyNote, TableFrame, th, td } from '@/components/commerce/ui'

const STATE_ICONS: Partial<Record<AiErrorCode, typeof AlertCircle>> = {
  AI_WORKFORCE_DISABLED: PauseCircle,
  UNAUTHORIZED: LogIn,
  FORBIDDEN: Lock,
  TENANT_MISMATCH: Lock,
  ENTITLEMENT_UNRESOLVED: ShieldAlert,
  POLICY_BLOCKED: ShieldOff,
  EMERGENCY_DISABLED: ShieldOff,
  EXECUTION_DISABLED: PauseCircle,
}

export function AiState({
  error,
  code,
  detail,
  copy,
  compact,
  onRetry,
  loginHref,
}: {
  error?: AiApiError
  code?: AiErrorCode
  detail?: string
  copy: AiEmployeesCopy
  compact?: boolean
  onRetry?: () => void
  loginHref?: string
}) {
  const resolved = code ?? error?.code ?? 'UNKNOWN'
  const message = detail ?? error?.detail
  const state = copy.states[resolved]
  const Icon = STATE_ICONS[resolved] ?? AlertCircle
  const retryable = (resolved === 'UNKNOWN' || resolved === 'RATE_LIMITED') && onRetry

  if (compact) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
        <Icon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <p className="text-foreground">
            <span className="font-medium">{state.title}.</span> <span className="text-muted-foreground">{state.body}</span>
          </p>
          {message && (
            <p className="text-xs text-muted-foreground">
              {copy.common.serverMessage}: {message}
            </p>
          )}
        </div>
      </div>
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

export function Notice({
  title,
  body,
  tone = 'info',
  icon: Icon = PauseCircle,
}: {
  title: string
  body: string
  tone?: 'info' | 'danger'
  icon?: typeof AlertCircle
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        tone === 'danger' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary/60',
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone === 'danger' ? 'text-destructive' : 'text-secondary-foreground')} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

export function AiPagination({
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
  copy: AiEmployeesCopy
}) {
  if (total <= take) return null
  return (
    <nav aria-label={copy.pagination.label} className="flex items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fill(copy.pagination.range, { from: skip + 1, to: Math.min(skip + take, total), total })}
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

export function lifecycleTone(status: string): PillTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAUSED') return 'info'
  if (status === 'ARCHIVED' || status === 'DRAFT') return 'muted'
  return 'neutral'
}

export function knowledgeTone(status: string): PillTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'IN_REVIEW' || status === 'APPROVED') return 'info'
  return 'muted'
}

export function sessionTone(status: string): PillTone {
  if (status === 'HANDOFF_PENDING') return 'danger'
  if (status === 'HANDOFF_ACTIVE') return 'info'
  if (status === 'CLOSED') return 'muted'
  return 'neutral'
}

export function localeLabel(copy: AiEmployeesCopy, tag: string | null | undefined) {
  if (!tag) return copy.common.none
  const base = tag.slice(0, 2).toLowerCase() as keyof AiEmployeesCopy['locales']
  return copy.locales[base] ?? tag
}

export function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const selectClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'
