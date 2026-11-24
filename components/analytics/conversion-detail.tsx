'use client'

import { useAnalyticsConversionDetail } from '@/lib/analytics-ui/client'
import { ServerNotes } from '@/components/analytics/measurement-detail'
import {
  AnalyticsState,
  DataStatePill,
  EmptyNote,
  KpiCard,
  LoadingRows,
  TableFrame,
  fmtCount,
  fmtRate,
  providerLabel,
  td,
  th,
  type TabProps,
} from '@/components/analytics/ui'

export function ConversionDetail({
  accountId,
  filters,
  locale,
  copy,
  loginHref,
  conversionKey,
  displayName,
}: TabProps & { conversionKey: string; displayName: string }) {
  const { data, error, mutate } = useAnalyticsConversionDetail(accountId, filters, conversionKey)
  const d = copy.drilldown
  const headingId = `conversion-detail-${conversionKey}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-base font-semibold text-foreground text-balance">
          {d.conversionTitle.replace('{name}', data?.displayName ?? displayName)}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{d.conversionDescription}</p>
      </div>

      {error && !data ? (
        error.code === 'NOT_FOUND' ? (
          <EmptyNote>{d.notFound}</EmptyNote>
        ) : (
          <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
        )
      ) : !data ? (
        <LoadingRows rows={3} label={copy.common.loading} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label={d.count} value={fmtCount(data.summary.count, locale)} copy={copy} />
            <KpiCard label={d.uniqueCount} value={fmtCount(data.summary.uniqueCount, locale)} copy={copy} />
            <KpiCard
              label={d.rate}
              value={data.summary.rate == null ? copy.values.unavailable : fmtRate(data.summary.rate, locale)}
              copy={copy}
            />
          </div>
          {!data.summary.sessionsKnown && <EmptyNote>{d.rateUnknown}</EmptyNote>}

          {data.daily.length === 0 ? (
            <EmptyNote>{d.emptyDaily}</EmptyNote>
          ) : (
            <TableFrame label={d.conversionTitle.replace('{name}', data.displayName)}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{d.date}</th>
                  <th scope="col" className={`${th} text-right`}>{d.count}</th>
                  <th scope="col" className={`${th} text-right`}>{d.uniqueCount}</th>
                  <th scope="col" className={th}>{d.status}</th>
                  <th scope="col" className={th}>{d.source}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily]
                  .sort((a, b) => a.periodDate.localeCompare(b.periodDate))
                  .map((point) => (
                    <tr key={point.idempotencyKey} className="border-t">
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{point.periodDate.slice(0, 10)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtCount(point.count, locale)}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtCount(point.uniqueCount, locale)}</td>
                      <td className={td}>
                        <DataStatePill state={point.dataState} copy={copy} />
                      </td>
                      <td className={td}>
                        <p className="text-xs text-foreground">{d.provenanceAggregate}</p>
                        <p className="text-xs text-muted-foreground">{providerLabel(copy, point.sourceProvider)}</p>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </TableFrame>
          )}
          <p className="text-xs text-muted-foreground">
            {d.timezone}: {data.timezone}
          </p>
          <ServerNotes title={d.serverNotes} notes={data.limitations} />
        </>
      )}
    </section>
  )
}
