'use client'

import { useAnalyticsSearch } from '@/lib/analytics-ui/client'
import { formatUtcDay, formatUtcTimestamp } from '@/lib/analytics-ui/range'
import { fill } from '@/lib/commerce-ui/format'
import {
  AnalyticsState,
  DataStatePill,
  KpiCard,
  LoadingRows,
  Notice,
  ProviderNotice,
  Section,
  SourceLine,
  fmtCount,
  fmtPosition,
  fmtRate,
  orNull,
  type TabProps,
} from '@/components/analytics/ui'

export function SearchTab({ accountId, filters, locale, copy, loginHref }: TabProps) {
  const { data, error, mutate } = useAnalyticsSearch(accountId, filters)

  if (error && !data) return <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows rows={4} label={copy.common.loading} />

  if (data.dataState === 'NOT_CONNECTED' || data.dataState === 'NOT_SUPPORTED') {
    return (
      <ProviderNotice
        state={data.dataState}
        title={copy.search.disconnectedTitle}
        body={copy.search.disconnectedBody}
        copy={copy}
      />
    )
  }

  const longDay = { year: 'numeric', month: 'short', day: 'numeric' } as const
  const period = data.dateRange ?? { start: filters.start, end: filters.end }
  const fmt = (v: number) => fmtCount(v, locale)

  return (
    <>
      <Section
        title={copy.search.title}
        description={copy.search.description}
        action={data.dataState !== 'READY' ? <DataStatePill state={data.dataState} copy={copy} /> : undefined}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label={copy.metrics.clicks} value={orNull(data.clicks, fmt)} copy={copy} />
            <KpiCard label={copy.metrics.impressions} value={orNull(data.impressions, fmt)} copy={copy} />
            <KpiCard label={copy.metrics.ctr} value={orNull(data.ctr, (v) => fmtRate(v, locale))} copy={copy} />
            <KpiCard
              label={copy.metrics.averagePosition}
              value={orNull(data.averagePosition, (v) => fmtPosition(v, locale))}
              hint={copy.metrics.averagePositionHint}
              copy={copy}
            />
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{copy.search.reportingPeriod}</dt>
              <dd className="font-medium text-foreground">
                {formatUtcDay(period.start, locale, longDay)} – {formatUtcDay(period.end, locale, longDay)} UTC
              </dd>
            </div>
            {data.asOf && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{copy.connections.updated}</dt>
                <dd className="font-medium text-foreground">
                  {fill(copy.search.asOf, { date: formatUtcTimestamp(data.asOf, locale) })}
                </dd>
              </div>
            )}
            {data.propertyRef && (
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">{copy.search.property}</dt>
                <dd className="truncate font-mono text-xs text-foreground">{data.propertyRef}</dd>
              </div>
            )}
          </dl>
          <SourceLine copy={copy} provider="GSC" />
        </div>
      </Section>

      <Notice title={copy.search.positionNoteTitle} body={copy.search.positionNoteBody} />

      <Section title={copy.search.historyTitle}>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.search.historyBody}</p>
      </Section>
    </>
  )
}
