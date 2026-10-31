'use client'

import { COHORT_KEYS, EVENT_KEYS, totalOf, type FunnelReport } from '@/lib/crm-ui/lead-funnel'
import { DASH, fill, formatNumber, formatPercent } from '@/lib/crm-ui/workspace'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'
import { cn } from '@/lib/utils'

function Metric({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: string
  hint: string
  emphasis?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm', emphasis && 'border-primary/40 bg-accent')}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </dd>
    </div>
  )
}

export function FunnelCohortMetrics({ report, locale, fc }: { report: FunnelReport; locale: string; fc: CrmLeadFunnelCopy }) {
  const received = totalOf(report.summary.leadsReceived)
  return (
    <section aria-labelledby="funnel-cohort-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-cohort-title" className="text-lg font-semibold tracking-tight text-foreground">
          {fc.cohort.title}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{fc.cohort.description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {COHORT_KEYS.map((key) => {
          const value = totalOf(report.summary[key])
          let hint = value == null ? fc.notTotal : fc.cohort.hints[key]
          if (key === 'converted' && value != null && received) {
            hint = `${hint}. ${fill(fc.cohort.convertedShare, { pct: formatPercent(value / received, locale) })}`
          }
          return (
            <Metric
              key={key}
              label={fc.cohort.metrics[key]}
              value={value == null ? DASH : formatNumber(value, locale)}
              hint={hint}
              emphasis={key === 'leadsReceived'}
            />
          )
        })}
      </dl>
    </section>
  )
}

export function FunnelEventMetrics({ report, locale, fc }: { report: FunnelReport; locale: string; fc: CrmLeadFunnelCopy }) {
  return (
    <section aria-labelledby="funnel-events-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-events-title" className="text-lg font-semibold tracking-tight text-foreground">
          {fc.events.title}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{fc.events.description}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {EVENT_KEYS.map((key) => {
          const value = totalOf(report[key])
          return (
            <Metric
              key={key}
              label={fc.events.metrics[key]}
              value={value == null ? DASH : formatNumber(value, locale)}
              hint={value == null ? fc.notTotal : fc.events.hints[key]}
            />
          )
        })}
      </dl>
    </section>
  )
}
