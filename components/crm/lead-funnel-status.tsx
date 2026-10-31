'use client'

import { STATUS_SEGMENTS, statusSegments, type FunnelReport, type StatusSegment } from '@/lib/crm-ui/lead-funnel'
import { formatNumber, formatPercent } from '@/lib/crm-ui/workspace'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'

const SEGMENT_COLOR: Record<StatusSegment, string> = {
  pending: 'bg-chart-2',
  duplicateReview: 'bg-chart-4',
  qualified: 'bg-chart-3',
  converted: 'bg-chart-1',
  rejected: 'bg-muted-foreground',
}

export function FunnelStatusDistribution({ report, locale, fc }: { report: FunnelReport; locale: string; fc: CrmLeadFunnelCopy }) {
  const s = fc.status
  const segments = statusSegments(report.summary)
  const total = segments ? STATUS_SEGMENTS.reduce((sum, key) => sum + segments[key], 0) : 0

  return (
    <section aria-labelledby="funnel-status-title" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-status-title" className="text-base font-semibold tracking-tight text-foreground">
          {s.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
      </div>
      {!segments ? (
        <p className="rounded-lg border border-dashed bg-muted px-4 py-6 text-sm leading-relaxed text-muted-foreground">{s.incomplete}</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={s.ariaLabel}>
            {total > 0 &&
              STATUS_SEGMENTS.filter((key) => segments[key] > 0).map((key) => (
                <span key={key} className={SEGMENT_COLOR[key]} style={{ width: `${(segments[key] / total) * 100}%` }} aria-hidden="true" />
              ))}
          </div>
          <ul className="flex flex-col divide-y">
            {STATUS_SEGMENTS.map((key) => (
              <li key={key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-2.5 shrink-0 rounded-sm ${SEGMENT_COLOR[key]}`} aria-hidden="true" />
                  <span className="truncate text-foreground">{s.segments[key]}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="font-semibold text-foreground">{formatNumber(segments[key], locale)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {total > 0 ? formatPercent(segments[key] / total, locale) : '—'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
