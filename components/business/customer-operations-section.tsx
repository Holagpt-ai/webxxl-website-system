'use client'

import Link from 'next/link'
import { Ban, CircleOff, Lock, PauseCircle, ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { StatusPill, type PillTone } from '@/components/crm/workspace-kit'
import { fill, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import type { Locale } from '@/lib/i18n/config'
import type { BusinessCenterCopy } from '@/lib/i18n/dictionaries/business-center-en'
import {
  LEAD_PIPELINE_METRICS,
  LEAD_PIPELINE_TOTAL,
  OPERATIONS_MAX_LINEAGE,
  normalizeReadiness,
  safeDestination,
  totalMetric,
  type CustomerOperationsSummary,
  type ReadinessState,
} from '@/lib/business-ui/types'
import { LineageRow } from './customer-operations-lineage'

const TONE: Record<ReadinessState, PillTone> = {
  available: 'success',
  disabled: 'muted',
  not_configured: 'muted',
  policy_unresolved: 'neutral',
  not_eligible: 'muted',
  unauthorized: 'danger',
  unavailable: 'danger',
}

const ICON: Record<Exclude<ReadinessState, 'available'>, LucideIcon> = {
  disabled: PauseCircle,
  not_configured: Ban,
  policy_unresolved: ShieldAlert,
  not_eligible: CircleOff,
  unauthorized: Lock,
  unavailable: TriangleAlert,
}

/** Same rule as the module cards: no link when the workspace would only repeat the gate. */
const HIDE_LINKS: ReadonlySet<ReadinessState> = new Set(['disabled', 'unauthorized'])

const NAV_KEYS = ['crmLeads', 'crmFunnel', 'projectDashboard'] as const

/**
 * Lead-pipeline readiness is reported independently of the CRM module card, so the two can differ.
 */
export function CustomerOperationsSection({
  summary,
  locale,
  copy,
}: {
  summary: CustomerOperationsSummary
  locale: Locale
  copy: BusinessCenterCopy
}) {
  const ops = copy.operations
  const readiness = normalizeReadiness(summary.leadPipeline?.readiness)
  const metrics = summary.leadPipeline?.summary
  const lineage = Array.isArray(summary.recentLineage)
    ? summary.recentLineage.slice(0, OPERATIONS_MAX_LINEAGE).filter((l) => l && typeof l.leadId === 'string')
    : []

  const nav = HIDE_LINKS.has(readiness.state)
    ? []
    : NAV_KEYS.map((key) => ({ key, href: safeDestination(locale, summary.navigation?.[key]) })).filter(
        (l): l is { key: (typeof NAV_KEYS)[number]; href: string } => l.href !== null,
      )

  return (
    <section aria-labelledby="business-operations-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="business-operations-title" className="text-lg font-semibold text-foreground">
            {ops.title}
          </h2>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">{ops.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{ops.statusLabel}</span>
          <StatusPill label={copy.readiness[readiness.state].label} tone={TONE[readiness.state]} />
        </div>
      </div>

      {readiness.state !== 'available' ? (
        <NotAvailable state={readiness.state} reasonCode={readiness.reasonCode} copy={copy} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground">
            <h3 className="sr-only">{ops.totalsLabel}</h3>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label={ops.total} value={totalMetric(metrics, LEAD_PIPELINE_TOTAL)} locale={locale} copy={copy} emphasis />
              {LEAD_PIPELINE_METRICS.map((key) => (
                <Metric key={key} label={ops.metrics[key]} value={totalMetric(metrics, key)} locale={locale} copy={copy} />
              ))}
            </dl>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>{ops.awaitingNote}</p>
              {readiness.sourceCheckedAt && (
                <time dateTime={readiness.sourceCheckedAt}>
                  {fill(copy.checkedAt, { time: formatDateTime(readiness.sourceCheckedAt, locale) })}
                </time>
              )}
            </div>
          </div>

          {readiness.empty ? (
            <p role="status" className="rounded-xl border border-dashed bg-muted p-6 text-sm leading-relaxed text-muted-foreground">
              {ops.empty}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-foreground">{ops.recentTitle}</h3>
                {lineage.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {fill(ops.recentNote, { count: lineage.length, max: OPERATIONS_MAX_LINEAGE })}
                  </p>
                )}
              </div>
              {lineage.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {lineage.map((lead) => (
                    <LineageRow key={lead.leadId} lead={lead} locale={locale} copy={ops} />
                  ))}
                </ul>
              ) : (
                <p role="status" className="rounded-xl border border-dashed bg-muted p-6 text-sm leading-relaxed text-muted-foreground">
                  {ops.recentEmpty}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {nav.length > 0 && (
        <nav aria-label={ops.navLabel} className="flex flex-wrap gap-x-6 gap-y-2">
          {nav.map((l) => (
            <Link key={l.key} href={l.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {ops.links[l.key]}
            </Link>
          ))}
        </nav>
      )}
    </section>
  )
}

/** Missing or non-account-total metrics read "Not reported", never zero. */
function Metric({
  label,
  value,
  locale,
  copy,
  emphasis = false,
}: {
  label: string
  value: number | null
  locale: Locale
  copy: BusinessCenterCopy
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd
        className={
          value === null
            ? 'text-sm text-muted-foreground'
            : emphasis
              ? 'text-3xl font-semibold tabular-nums text-foreground'
              : 'text-2xl font-semibold tabular-nums text-foreground'
        }
      >
        {value === null ? copy.operations.notReported : formatNumber(value, locale)}
      </dd>
    </div>
  )
}

function NotAvailable({
  state,
  reasonCode,
  copy,
}: {
  state: Exclude<ReadinessState, 'available'>
  reasonCode: string
  copy: BusinessCenterCopy
}) {
  const Icon = ICON[state]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted p-6">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.readiness[state].body}</p>
        {reasonCode && reasonCode !== 'READINESS_MISSING' && (
          <p className="font-mono text-xs text-muted-foreground">{fill(copy.referenceCode, { code: reasonCode })}</p>
        )}
      </div>
    </div>
  )
}
