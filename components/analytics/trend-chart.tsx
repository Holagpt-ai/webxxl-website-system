'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fill } from '@/lib/commerce-ui/format'
import { formatUtcDay } from '@/lib/analytics-ui/range'
import type { AnalyticsCopy } from '@/lib/i18n/dictionaries/analytics-en'
import { fmtCompact, fmtCount, providerLabel } from '@/components/analytics/ui'

export type ChartPoint = { date: string; value: number | null }

export function TrendChart({
  points,
  metricLabel,
  provider,
  start,
  end,
  locale,
  copy,
}: {
  points: ChartPoint[]
  metricLabel: string
  provider: string
  start: string
  end: string
  locale: string
  copy: AnalyticsCopy
}) {
  const hasData = points.some((p) => p.value != null)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-muted px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{copy.chart.emptyTitle}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{copy.chart.emptyBody}</p>
      </div>
    )
  }

  const hasGaps = points.some((p) => p.value == null)
  const ariaLabel = fill(copy.chart.ariaLabel, {
    metric: metricLabel,
    start: formatUtcDay(start, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    end: formatUtcDay(end, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
  })

  return (
    <figure className="flex flex-col gap-3">
      <div className="h-64 w-full" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatUtcDay(d, locale)}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(v: number) => fmtCompact(v, locale)}
              width={44}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const raw = payload[0]?.value
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
                    <p className="font-medium">
                      {formatUtcDay(String(label), locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-muted-foreground">
                      {metricLabel}:{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        {raw == null ? copy.values.unavailable : fmtCount(Number(raw), locale)}
                      </span>
                    </p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={metricLabel}
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="var(--chart-1)"
              fillOpacity={0.12}
              connectNulls={false}
              isAnimationActive={false}
              dot={points.length <= 31 ? { r: 2, fill: 'var(--chart-1)', strokeWidth: 0 } : false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="sr-only">{copy.chart.legend}: </span>
          <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden="true" />
          {metricLabel} · {copy.chart.current}
        </span>
        <span>{fill(copy.source, { provider: providerLabel(copy, provider) })}</span>
        <span>{copy.filters.utcNote}</span>
        {hasGaps && <span>{copy.chart.gapNote}</span>}
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          {copy.chart.tableToggle}
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {copy.chart.date}
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                  {metricLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t">
                  <td className="px-3 py-1.5">
                    {formatUtcDay(p.date, locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.value == null ? copy.values.unavailable : fmtCount(p.value, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
