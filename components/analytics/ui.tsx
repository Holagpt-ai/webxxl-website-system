'use client'

import { AlertCircle, ArrowDownRight, ArrowUpRight, Lock, LogIn, Minus, PauseCircle, ShieldAlert, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill, type PillTone } from '@/components/commerce/ui'
import type {
  AnalyticsApiError,
  AnalyticsErrorCode,
  AnalyticsFilters,
  AnalyticsFreshnessState,
  AnalyticsPeriodChangeDto,
} from '@/lib/analytics-ui/client'
import { fill } from '@/lib/commerce-ui/format'
import type { AnalyticsCopy } from '@/lib/i18n/dictionaries/analytics-en'
import { cn } from '@/lib/utils'

export { Section, StatusPill, LoadingRows, EmptyNote, TableFrame, th, td } from '@/components/commerce/ui'
export { Notice } from '@/components/ai-employees/ui'

export type TabProps = {
  accountId: string
  filters: AnalyticsFilters
  locale: string
  copy: AnalyticsCopy
  loginHref: string
}

const intlLocale = (locale: string) => (locale === 'es' ? 'es-US' : 'en-US')

export function fmtCount(value: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

export function fmtCompact(value: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Rates from the API are fractions (0–1). */
export function fmtRate(fraction: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 2 }).format(fraction)
}

export function fmtPosition(value: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

export function orNull<T>(value: T | null | undefined, format: (v: T) => string) {
  return value == null ? null : format(value)
}

export function providerLabel(copy: AnalyticsCopy, provider: string) {
  return copy.providers[provider] ?? provider
}

export const UNCONNECTED_STATES: AnalyticsFreshnessState[] = ['NOT_CONNECTED', 'PENDING', 'NOT_SUPPORTED']

export function freshnessTone(state: AnalyticsFreshnessState): PillTone {
  if (state === 'READY') return 'success'
  if (state === 'ERROR') return 'danger'
  if (state === 'PARTIAL' || state === 'STALE') return 'info'
  return 'muted'
}

export function DataStatePill({ state, copy }: { state: AnalyticsFreshnessState; copy: AnalyticsCopy }) {
  return (
    <span title={copy.dataStateHelp[state]}>
      <StatusPill label={copy.dataStates[state] ?? state} tone={freshnessTone(state)} />
    </span>
  )
}

export function SourceLine({ copy, provider, className }: { copy: AnalyticsCopy; provider: string; className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {fill(copy.source, { provider: providerLabel(copy, provider) })}
    </p>
  )
}

export function KpiCard({
  label,
  value,
  copy,
  state,
  hint,
  footer,
}: {
  label: string
  value: string | null
  copy: AnalyticsCopy
  state?: AnalyticsFreshnessState
  hint?: string
  footer?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {state && state !== 'READY' && <DataStatePill state={state} copy={copy} />}
      </div>
      {value == null ? (
        <>
          <p className="text-2xl font-semibold text-muted-foreground/60">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{copy.values.unavailable}</span>
          </p>
          <p className="text-xs text-muted-foreground">{copy.values.unavailableHint}</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
          {footer}
        </>
      )}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ChangeIndicator({
  change,
  copy,
  locale,
}: {
  change: AnalyticsPeriodChangeDto | undefined
  copy: AnalyticsCopy
  locale: string
}) {
  if (!change || change.percentChange == null) {
    return <p className="text-xs text-muted-foreground">{copy.values.noComparison}</p>
  }
  const pct = change.percentChange
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct)
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-medium',
          pct > 0 ? 'text-success' : pct < 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {pct === 0 ? copy.values.flat : `${formatted}%`}
      </span>
      <span>{copy.values.vsPrevious}</span>
    </p>
  )
}

const STATE_ICONS: Partial<Record<AnalyticsErrorCode, typeof AlertCircle>> = {
  ANALYTICS_DISABLED: PauseCircle,
  UNAUTHORIZED: LogIn,
  FORBIDDEN: Lock,
  TENANT_MISMATCH: Lock,
  ENTITLEMENT_UNRESOLVED: ShieldAlert,
  PROVIDER_UNAVAILABLE: Unplug,
}

export const GATE_CODES: AnalyticsErrorCode[] = [
  'ANALYTICS_DISABLED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TENANT_MISMATCH',
  'ENTITLEMENT_UNRESOLVED',
]

export function AnalyticsState({
  error,
  copy,
  onRetry,
  loginHref,
}: {
  error: AnalyticsApiError
  copy: AnalyticsCopy
  onRetry?: () => void
  loginHref?: string
}) {
  const state = copy.states[error.code]
  const Icon = STATE_ICONS[error.code] ?? AlertCircle
  const retryable = (error.code === 'UNKNOWN' || error.code === 'PROVIDER_UNAVAILABLE') && onRetry

  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{state.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
        {error.detail && error.code === 'VALIDATION' && (
          <p className="text-xs text-muted-foreground">
            {copy.common.serverMessage}: {error.detail}
          </p>
        )}
      </div>
      {retryable && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {copy.common.retry}
        </Button>
      )}
      {error.code === 'UNAUTHORIZED' && loginHref && (
        <Button size="sm" render={<a href={loginHref} />}>
          <LogIn className="size-4" aria-hidden="true" />
          {copy.states.UNAUTHORIZED.title}
        </Button>
      )}
    </div>
  )
}

/** Shown in place of metrics when a provider is not connected, pending, or unsupported. */
export function ProviderNotice({
  state,
  title,
  body,
  copy,
}: {
  state: AnalyticsFreshnessState
  title: string
  body: string
  copy: AnalyticsCopy
}) {
  return (
    <div role="note" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-5 sm:flex-row">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Unplug className="size-4" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          <DataStatePill state={state} copy={copy} />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
