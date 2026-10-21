'use client'

import { useId, useState } from 'react'
import {
  TREND_METRICS,
  useAnalyticsOverview,
  useAnalyticsTraffic,
  useAnalyticsTrend,
  type TrendMetric,
} from '@/lib/analytics-ui/client'
import { selectClass } from '@/components/ai-employees/ui'
import { TrendChart } from '@/components/analytics/trend-chart'
import {
  AnalyticsState,
  ChangeIndicator,
  DataStatePill,
  EmptyNote,
  LoadingRows,
  ProviderNotice,
  Section,
  TableFrame,
  UNCONNECTED_STATES,
  fmtCount,
  fmtRate,
  td,
  th,
  type TabProps,
} from '@/components/analytics/ui'

export function TrafficTab({ accountId, filters, locale, copy, loginHref }: TabProps) {
  const ids = useId()
  const [metric, setMetric] = useState<TrendMetric>('ga4.sessions')
  const traffic = useAnalyticsTraffic(accountId, filters)
  const connected = Boolean(traffic.data && !UNCONNECTED_STATES.includes(traffic.data.dataState))
  const trend = useAnalyticsTrend(accountId, filters, metric, connected)
  const overview = useAnalyticsOverview(accountId, filters, connected)

  if (traffic.error && !traffic.data) {
    return <AnalyticsState error={traffic.error} copy={copy} onRetry={() => traffic.mutate()} loginHref={loginHref} />
  }
  if (!traffic.data) return <LoadingRows rows={4} label={copy.common.loading} />

  const state = traffic.data.dataState
  if (!connected) {
    const pending = state === 'PENDING'
    return (
      <ProviderNotice
        state={state}
        title={pending ? copy.traffic.pendingTitle : copy.traffic.disconnectedTitle}
        body={pending ? copy.traffic.pendingBody : copy.traffic.disconnectedBody}
        copy={copy}
      />
    )
  }

  const metricLabel = copy.trendMetrics[metric]
  const acquisition = [...(overview.data?.acquisition ?? [])].sort((a, b) => (b.sessions ?? -1) - (a.sessions ?? -1))
  const reportedTotal = acquisition.reduce((sum, r) => sum + (r.sessions ?? 0), 0)

  return (
    <>
      <Section
        title={copy.traffic.trendTitle}
        description={copy.traffic.trendDescription}
        action={
          <div className="flex items-center gap-2">
            {state !== 'READY' && <DataStatePill state={state} copy={copy} />}
            <label htmlFor={`${ids}-metric`} className="sr-only">
              {copy.filters.metric}
            </label>
            <select
              id={`${ids}-metric`}
              className={`${selectClass} w-auto`}
              value={metric}
              onChange={(e) => setMetric(e.target.value as TrendMetric)}
            >
              {TREND_METRICS.map((m) => (
                <option key={m} value={m}>
                  {copy.trendMetrics[m]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {trend.error && !trend.data ? (
          <AnalyticsState error={trend.error} copy={copy} onRetry={() => trend.mutate()} />
        ) : !trend.data ? (
          <LoadingRows rows={3} label={copy.common.loading} />
        ) : (
          <TrendChart
            points={trend.data.points}
            metricLabel={metricLabel}
            provider={trend.data.provider}
            start={filters.start}
            end={filters.end}
            locale={locale}
            copy={copy}
          />
        )}
      </Section>

      <Section title={copy.traffic.changesTitle} description={copy.traffic.changesDescription}>
        {traffic.data.periodChanges.length === 0 ? (
          <EmptyNote>{copy.values.noComparison}</EmptyNote>
        ) : (
          <TableFrame label={copy.traffic.changesTitle}>
            <thead>
              <tr>
                <th scope="col" className={th}>{copy.traffic.metric}</th>
                <th scope="col" className={`${th} text-right`}>{copy.traffic.current}</th>
                <th scope="col" className={`${th} text-right`}>{copy.traffic.previous}</th>
                <th scope="col" className={th}>{copy.traffic.change}</th>
              </tr>
            </thead>
            <tbody>
              {traffic.data.periodChanges.map((c) => (
                <tr key={c.metric} className="border-t">
                  <td className={`${td} font-medium`}>
                    {copy.trendMetrics[c.metric as TrendMetric] ?? c.metric}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {c.current == null ? copy.values.unavailable : fmtCount(c.current, locale)}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {c.previous == null ? copy.values.unavailable : fmtCount(c.previous, locale)}
                  </td>
                  <td className={td}>
                    <ChangeIndicator change={c} copy={copy} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>

      <Section title={copy.traffic.acquisitionTitle} description={copy.traffic.acquisitionDescription}>
        {overview.error && !overview.data ? (
          <AnalyticsState error={overview.error} copy={copy} onRetry={() => overview.mutate()} />
        ) : !overview.data ? (
          <LoadingRows rows={3} label={copy.common.loading} />
        ) : acquisition.length === 0 ? (
          <EmptyNote>{copy.traffic.acquisitionEmpty}</EmptyNote>
        ) : (
          <TableFrame label={copy.traffic.acquisitionTitle}>
            <thead>
              <tr>
                <th scope="col" className={th}>{copy.traffic.channel}</th>
                <th scope="col" className={`${th} text-right`}>{copy.metrics.sessions}</th>
                <th scope="col" className={`${th} text-right`}>{copy.traffic.share}</th>
              </tr>
            </thead>
            <tbody>
              {acquisition.map((row) => (
                <tr key={row.channel} className="border-t">
                  <td className={`${td} font-medium`}>{row.channel}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {row.sessions == null ? copy.values.unavailable : fmtCount(row.sessions, locale)}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {row.sessions == null || reportedTotal === 0
                      ? copy.values.unavailable
                      : fmtRate(row.sessions / reportedTotal, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>
    </>
  )
}
