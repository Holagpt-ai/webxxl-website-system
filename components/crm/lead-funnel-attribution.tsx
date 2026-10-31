'use client'

import { Check, Info, Link2, Link2Off } from 'lucide-react'
import { StatusPill } from './workspace-kit'
import { totalOf, type FunnelReport } from '@/lib/crm-ui/lead-funnel'
import { fill, formatNumber } from '@/lib/crm-ui/workspace'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'

export function FunnelAttribution({ report, locale, fc }: { report: FunnelReport; locale: string; fc: CrmLeadFunnelCopy }) {
  const a = fc.attribution
  const { attribution } = report
  const linked = attribution.analyticsEventLinkedLeads
  const total = totalOf(report.summary.leadsReceived)
  const hasLinks = linked > 0

  return (
    <section aria-labelledby="funnel-attribution-title" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="funnel-attribution-title" className="text-base font-semibold tracking-tight text-foreground">
            {a.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
        </div>
        <StatusPill
          label={attribution.state === 'verified_partial' ? a.stateVerifiedPartial : a.stateNone}
          tone={attribution.state === 'verified_partial' ? 'info' : 'muted'}
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          {hasLinks ? <Link2 className="size-4" aria-hidden="true" /> : <Link2Off className="size-4" aria-hidden="true" />}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">{a.linkedTitle}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {hasLinks && total != null
              ? fill(a.linked, { count: formatNumber(linked, locale), total: formatNumber(total, locale) })
              : hasLinks
                ? formatNumber(linked, locale)
                : a.noneLinked}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{a.fieldsTitle}</h3>
        <ul className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {attribution.labelKeys.map((key) => (
            <li key={key} className="flex items-center gap-2 text-foreground">
              <Check className="size-3.5 shrink-0 text-chart-3" aria-hidden="true" />
              {a.fields[key] ?? key}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {a.disclaimer}
      </p>
    </section>
  )
}
