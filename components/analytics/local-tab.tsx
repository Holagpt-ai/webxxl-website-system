'use client'

import { MapPin } from 'lucide-react'
import { useAnalyticsLocal } from '@/lib/analytics-ui/client'
import { fill } from '@/lib/commerce-ui/format'
import {
  AnalyticsState,
  DataStatePill,
  KpiCard,
  LoadingRows,
  ProviderNotice,
  Section,
  SourceLine,
  fmtCount,
  orNull,
  type TabProps,
} from '@/components/analytics/ui'

export function LocalTab({ accountId, filters, locale, copy, loginHref }: TabProps) {
  const { data, error, mutate } = useAnalyticsLocal(accountId, filters)

  if (error && !data) return <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows rows={4} label={copy.common.loading} />

  const fmt = (v: number) => fmtCount(v, locale)
  const notConnected = data.dataState === 'NOT_CONNECTED' || data.dataState === 'NOT_SUPPORTED'

  return (
    <>
      {notConnected ? (
        <ProviderNotice
          state={data.dataState}
          title={data.dataState === 'NOT_SUPPORTED' ? copy.local.unsupportedTitle : copy.local.disconnectedTitle}
          body={data.dataState === 'NOT_SUPPORTED' ? copy.local.unsupportedBody : copy.local.disconnectedBody}
          copy={copy}
        />
      ) : (
        <Section
          title={copy.local.gbpTitle}
          description={copy.local.description}
          action={data.dataState !== 'READY' ? <DataStatePill state={data.dataState} copy={copy} /> : undefined}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard label={copy.metrics.profileViews} value={orNull(data.profileViews, fmt)} copy={copy} />
              <KpiCard label={copy.metrics.searchQueries} value={orNull(data.searchQueries, fmt)} copy={copy} />
              <KpiCard label={copy.metrics.actions} value={orNull(data.actions, fmt)} copy={copy} />
            </div>
            <SourceLine copy={copy} provider="GBP" />
          </div>
        </Section>
      )}

      <Section title={copy.local.rankTitle}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <MapPin className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-foreground">
              {data.rankObservations > 0
                ? fill(copy.local.rankBody, { count: fmt(data.rankObservations) })
                : copy.local.rankNone}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{copy.local.rankNote}</p>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={copy.local.trendTitle}>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.local.trendBody}</p>
        </Section>
        {data.limitations.length > 0 && (
          <Section title={copy.local.limitationsTitle}>
            {/* Limitations are provider-supplied strings returned by the API in English. */}
            <ul lang="en" className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {data.limitations.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  )
}
