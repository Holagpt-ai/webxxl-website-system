'use client'

import { useAnalyticsConversions } from '@/lib/analytics-ui/client'
import {
  AnalyticsState,
  DataStatePill,
  EmptyNote,
  KpiCard,
  LoadingRows,
  Notice,
  Section,
  TableFrame,
  fmtCount,
  fmtRate,
  providerLabel,
  td,
  th,
  type TabProps,
} from '@/components/analytics/ui'

export function ConversionsTab({ accountId, filters, locale, copy, loginHref }: TabProps) {
  const { data, error, mutate } = useAnalyticsConversions(accountId, filters)

  if (error && !data) return <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows rows={4} label={copy.common.loading} />

  const rows = [...data].sort((a, b) => b.count - a.count)
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <>
      <Section title={copy.conversions.title} description={copy.conversions.description}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-muted px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">{copy.conversions.emptyTitle}</p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{copy.conversions.emptyBody}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KpiCard label={copy.conversions.totalLabel} value={fmtCount(total, locale)} copy={copy} />
              <KpiCard label={copy.conversions.goalsLabel} value={fmtCount(rows.length, locale)} copy={copy} />
            </div>
            <TableFrame label={copy.conversions.title}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{copy.conversions.goal}</th>
                  <th scope="col" className={`${th} text-right`}>{copy.conversions.count}</th>
                  <th scope="col" className={`${th} text-right`}>{copy.conversions.rate}</th>
                  <th scope="col" className={th}>{copy.conversions.source}</th>
                  <th scope="col" className={th}>{copy.conversions.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.conversionKey} className="border-t">
                    <td className={td}>
                      <p className="font-medium text-foreground">{row.displayName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.conversionKey}</p>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{fmtCount(row.count, locale)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {row.rate == null ? (
                        <span className="text-muted-foreground">{copy.values.unavailable}</span>
                      ) : (
                        fmtRate(row.rate, locale)
                      )}
                    </td>
                    <td className={td}>{providerLabel(copy, row.sourceProvider)}</td>
                    <td className={td}>
                      <DataStatePill state={row.dataState} copy={copy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            {rows.some((r) => r.rate == null) && <EmptyNote>{copy.conversions.rateNote}</EmptyNote>}
          </div>
        )}
      </Section>
      <Notice title={copy.conversions.title} body={copy.conversions.attributionNote} />
    </>
  )
}
