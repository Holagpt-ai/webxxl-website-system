'use client'

import { useId, useState } from 'react'
import { MEASUREMENT_METRICS, useAnalyticsMeasurements, type MeasurementMetric } from '@/lib/analytics-ui/client'
import { selectClass } from '@/components/ai-employees/ui'
import {
  AnalyticsState,
  DataStatePill,
  EmptyNote,
  LoadingRows,
  Section,
  TableFrame,
  fmtCount,
  providerLabel,
  td,
  th,
  type TabProps,
} from '@/components/analytics/ui'

function fmtDateTime(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
}

export function ServerNotes({ title, notes }: { title: string; notes: string[] }) {
  if (notes.length === 0) return null
  return (
    <details className="rounded-lg border bg-muted px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">{title}</summary>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 leading-relaxed text-muted-foreground" lang="en">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  )
}

export function MeasurementDetail({
  accountId,
  filters,
  locale,
  copy,
  loginHref,
  initialMetric = 'ga4.sessions',
}: TabProps & { initialMetric?: MeasurementMetric }) {
  const selectId = useId()
  const [metric, setMetric] = useState<MeasurementMetric>(initialMetric)
  const { data, error, mutate, isValidating } = useAnalyticsMeasurements(accountId, filters, metric)
  const d = copy.drilldown

  const points = [...(data?.points ?? [])].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  return (
    <Section title={d.measurementsTitle} description={d.measurementsDescription}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor={selectId} className="text-sm font-medium text-foreground">
            {d.metricLabel}
          </label>
          <select
            id={selectId}
            className={selectClass}
            value={metric}
            onChange={(event) => setMetric(event.target.value as MeasurementMetric)}
          >
            {MEASUREMENT_METRICS.map((key) => (
              <option key={key} value={key}>
                {d.metricNames[key]}
              </option>
            ))}
          </select>
        </div>

        {error && !data ? (
          <AnalyticsState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
        ) : !data ? (
          <LoadingRows rows={4} label={copy.common.loading} />
        ) : (
          <div className="flex flex-col gap-3" aria-busy={isValidating}>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{d.provider}:</dt>
                <dd className="font-medium text-foreground">{providerLabel(copy, data.provider)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{d.timezone}:</dt>
                <dd className="font-medium text-foreground">{data.timezone}</dd>
              </div>
            </dl>

            {points.length === 0 ? (
              <EmptyNote>{d.emptyMeasurements}</EmptyNote>
            ) : (
              <TableFrame label={d.measurementsTitle}>
                <thead>
                  <tr>
                    <th scope="col" className={th}>{d.date}</th>
                    <th scope="col" className={`${th} text-right`}>{d.value}</th>
                    <th scope="col" className={th}>{d.status}</th>
                    <th scope="col" className={th}>{d.source}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.idempotencyKey} className="border-t">
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{point.date ?? d.noDate}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {point.value == null ? (
                          <span className="text-muted-foreground">{copy.values.unavailable}</span>
                        ) : (
                          fmtCount(point.value, locale)
                        )}
                      </td>
                      <td className={td}>
                        <DataStatePill state={point.dataState} copy={copy} />
                      </td>
                      <td className={td}>
                        <p className="text-xs text-foreground">{d.provenanceObservation}</p>
                        <p className="max-w-56 truncate font-mono text-xs text-muted-foreground" title={point.sourceRef}>
                          {point.sourceRef}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.recordedAt}: {fmtDateTime(point.observedAt, locale)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            )}
            <ServerNotes title={d.serverNotes} notes={data.limitations} />
          </div>
        )}
      </div>
    </Section>
  )
}
