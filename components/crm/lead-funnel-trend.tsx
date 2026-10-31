'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fillTrend, type FunnelReport } from '@/lib/crm-ui/lead-funnel'
import { fill, formatNumber } from '@/lib/crm-ui/workspace'
import { formatUtcDay } from '@/lib/analytics-ui/range'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'

const LONG_DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

export function FunnelTrend({ report, locale, fc }: { report: FunnelReport; locale: string; fc: CrmLeadFunnelCopy }) {
  const { createdFrom, createdTo } = report.filters
  const points = useMemo(() => fillTrend(report.creationTrend, createdFrom, createdTo), [report.creationTrend, createdFrom, createdTo])
  const peak = points.reduce<(typeof points)[number] | null>((best, p) => (p.value > (best?.value ?? 0) ? p : best), null)
  const t = fc.trend

  return (
    <section aria-labelledby="funnel-trend-title" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 id="funnel-trend-title" className="text-base font-semibold tracking-tight text-foreground">
          {t.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.description}</p>
      </div>
      <figure className="flex flex-col gap-3">
        <div
          className="h-56 w-full sm:h-64"
          role="img"
          aria-label={fill(t.ariaLabel, {
            start: formatUtcDay(createdFrom, locale, LONG_DAY),
            end: formatUtcDay(createdTo, locale, LONG_DAY),
          })}
        >
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
                width={36}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
                      <p className="font-medium">{formatUtcDay(String(label), locale, LONG_DAY)}</p>
                      <p className="text-muted-foreground">
                        {t.series}:{' '}
                        <span className="font-medium tabular-nums text-foreground">{formatNumber(Number(payload[0]?.value), locale)}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={t.series}
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.14}
                isAnimationActive={false}
                dot={points.length <= 31 ? { r: 2, fill: 'var(--chart-1)', strokeWidth: 0 } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden="true" />
            {t.series}
          </span>
          {peak && (
            <span>{fill(t.peak, { date: formatUtcDay(peak.date, locale, LONG_DAY), count: formatNumber(peak.value, locale) })}</span>
          )}
          <span>{fc.filters.utcNote}</span>
        </figcaption>
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">{t.tableToggle}</summary>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                    {t.date}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                    {t.series}
                  </th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.date} className="border-t">
                    <td className="px-3 py-1.5">{formatUtcDay(p.date, locale, LONG_DAY)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(p.value, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figure>
    </section>
  )
}
