'use client'

import { useAnalyticsOverview, type AnalyticsCrmRelationshipDto } from '@/lib/analytics-ui/client'
import { formatUtcTimestamp } from '@/lib/analytics-ui/range'
import { fill } from '@/lib/commerce-ui/format'
import type { AnalyticsCopy } from '@/lib/i18n/dictionaries/analytics-en'
import { TrendChart } from '@/components/analytics/trend-chart'
import {
  AnalyticsState,
  ChangeIndicator,
  DataStatePill,
  KpiCard,
  LoadingRows,
  Notice,
  Section,
  SourceLine,
  fmtCount,
  fmtPosition,
  fmtRate,
  orNull,
  providerLabel,
  type TabProps,
} from '@/components/analytics/ui'

export function OverviewTab({ accountId, filters, locale, copy, loginHref }: TabProps) {
  const { data, error, mutate } = useAnalyticsOverview(accountId, filters)

  if (error && !data) return <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows rows={4} label={copy.common.loading} />

  const sessions = data.traffic.periodChanges.find((c) => c.metric === 'ga4.sessions')
  const latestUsers = [...data.traffic.series].reverse().find((p) => p.users != null)?.users ?? null
  const conversionTotal = data.conversions.length ? data.conversions.reduce((sum, r) => sum + r.count, 0) : null
  const fmt = (v: number) => fmtCount(v, locale)

  return (
    <>
      <Section title={copy.overview.kpisTitle} description={copy.overview.kpisDescription}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={copy.metrics.sessions}
            value={orNull(sessions?.current, fmt)}
            state={data.traffic.dataState}
            copy={copy}
            footer={<ChangeIndicator change={sessions} copy={copy} locale={locale} />}
          />
          <KpiCard
            label={copy.metrics.usersLatest}
            value={orNull(latestUsers, fmt)}
            state={data.traffic.dataState}
            copy={copy}
            footer={<SourceLine copy={copy} provider="GA4" />}
          />
          <KpiCard
            label={copy.metrics.clicks}
            value={orNull(data.search.clicks, fmt)}
            state={data.search.dataState}
            copy={copy}
            footer={<SourceLine copy={copy} provider="GSC" />}
          />
          <KpiCard
            label={copy.metrics.impressions}
            value={orNull(data.search.impressions, fmt)}
            state={data.search.dataState}
            copy={copy}
            footer={<SourceLine copy={copy} provider="GSC" />}
          />
          <KpiCard
            label={copy.metrics.ctr}
            value={orNull(data.search.ctr, (v) => fmtRate(v, locale))}
            state={data.search.dataState}
            copy={copy}
            footer={<SourceLine copy={copy} provider="GSC" />}
          />
          <KpiCard
            label={copy.metrics.averagePosition}
            value={orNull(data.search.averagePosition, (v) => fmtPosition(v, locale))}
            state={data.search.dataState}
            copy={copy}
            hint={copy.metrics.averagePositionHint}
          />
          <KpiCard
            label={copy.metrics.profileViews}
            value={orNull(data.local.profileViews, fmt)}
            state={data.local.dataState}
            copy={copy}
            footer={<SourceLine copy={copy} provider="GBP" />}
          />
          <KpiCard
            label={copy.metrics.conversions}
            value={orNull(conversionTotal, fmt)}
            copy={copy}
            footer={<SourceLine copy={copy} provider="WEBXXL_EVENTS" />}
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title={copy.overview.trafficTrend}>
            <TrendChart
              points={data.traffic.series.map((p) => ({ date: p.date, value: p.sessions }))}
              metricLabel={copy.metrics.sessions}
              provider="GA4"
              start={filters.start}
              end={filters.end}
              locale={locale}
              copy={copy}
            />
          </Section>
        </div>
        <Section title={copy.overview.freshnessTitle} description={copy.overview.freshnessDescription}>
          <ul className="flex flex-col divide-y">
            {data.freshness.map((f) => (
              <li key={f.provider} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-sm font-medium text-foreground">{providerLabel(copy, f.provider)}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.observedAt
                      ? fill(copy.overview.observedAt, { date: formatUtcTimestamp(f.observedAt, locale) })
                      : copy.overview.neverObserved}
                  </p>
                </div>
                <DataStatePill state={f.dataState} copy={copy} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            {data.sync.ingestionEnabled ? copy.connections.ingestionOn : copy.connections.ingestionOff}
          </p>
        </Section>
      </div>

      <CrmPanel crm={data.crm} copy={copy} locale={locale} />
    </>
  )
}

function CrmPanel({ crm, copy, locale }: { crm: AnalyticsCrmRelationshipDto; copy: AnalyticsCopy; locale: string }) {
  const fmt = (v: number) => fmtCount(v, locale)
  return (
    <Section title={copy.crm.title} description={copy.crm.description}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label={copy.metrics.leadsCreated} value={fmt(crm.leadsCreated)} state={crm.dataState} copy={copy} />
          <KpiCard label={copy.metrics.leadsConverted} value={fmt(crm.leadsConverted)} state={crm.dataState} copy={copy} />
          <KpiCard label={copy.metrics.openDeals} value={fmt(crm.openDeals)} state={crm.dataState} copy={copy} />
        </div>
        <Notice title={copy.crm.title} body={copy.crm.disclaimer} />
      </div>
    </Section>
  )
}
