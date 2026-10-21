'use client'

import { useId, useState } from 'react'
import { useAnalyticsProperties, useAnalyticsSyncStatus } from '@/lib/analytics-ui/client'
import { formatUtcTimestamp } from '@/lib/analytics-ui/range'
import { selectClass } from '@/components/ai-employees/ui'
import type { SiteOption } from '@/components/analytics/filters'
import {
  AnalyticsState,
  DataStatePill,
  EmptyNote,
  LoadingRows,
  Notice,
  Section,
  StatusPill,
  TableFrame,
  providerLabel,
  td,
  th,
  type TabProps,
} from '@/components/analytics/ui'

export function ConnectionsTab({
  accountId,
  filters,
  locale,
  copy,
  loginHref,
  sites,
}: TabProps & { sites: SiteOption[] }) {
  const ids = useId()
  const [scope, setScope] = useState<'all' | 'site'>('all')
  const properties = useAnalyticsProperties(accountId, filters, scope === 'all')
  const sync = useAnalyticsSyncStatus(accountId, filters)
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id
  const ts = (iso: string | null) => (iso ? formatUtcTimestamp(iso, locale) : copy.connections.never)

  return (
    <>
      <Notice title={copy.connections.title} body={copy.connections.infoNote} />

      <Section
        title={copy.connections.title}
        description={copy.connections.description}
        action={
          <div className="flex items-center gap-2">
            <label htmlFor={`${ids}-scope`} className="sr-only">
              {copy.connections.scopeLabel}
            </label>
            <select
              id={`${ids}-scope`}
              className={`${selectClass} w-auto`}
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'site')}
            >
              <option value="all">{copy.connections.scopeAll}</option>
              <option value="site">{copy.connections.scopeSite}</option>
            </select>
          </div>
        }
      >
        {properties.error && !properties.data ? (
          <AnalyticsState error={properties.error} copy={copy} onRetry={() => properties.mutate()} loginHref={loginHref} />
        ) : !properties.data ? (
          <LoadingRows rows={3} label={copy.common.loading} />
        ) : properties.data.length === 0 ? (
          <EmptyNote>{copy.connections.empty}</EmptyNote>
        ) : (
          <TableFrame label={copy.connections.title}>
            <thead>
              <tr>
                <th scope="col" className={th}>{copy.connections.provider}</th>
                <th scope="col" className={th}>{copy.connections.site}</th>
                <th scope="col" className={th}>{copy.connections.property}</th>
                <th scope="col" className={th}>{copy.connections.verification}</th>
                <th scope="col" className={th}>{copy.connections.status}</th>
                <th scope="col" className={th}>{copy.connections.lastVerified}</th>
              </tr>
            </thead>
            <tbody>
              {properties.data.map((p) => (
                <tr key={`${p.managedSiteId}-${p.provider}-${p.propertyRef}`} className="border-t">
                  <td className={`${td} font-medium`}>{providerLabel(copy, p.provider)}</td>
                  <td className={td}>
                    <p className="text-foreground">{p.siteName || siteName(p.managedSiteId)}</p>
                    {p.domain && <p className="text-xs text-muted-foreground">{p.domain}</p>}
                  </td>
                  <td className={td}>
                    <p className="font-mono text-xs text-foreground">{p.propertyRef}</p>
                    <p className="text-xs text-muted-foreground">{p.propertyKind}</p>
                  </td>
                  <td className={td}>
                    <span className="font-mono text-xs text-muted-foreground">{p.verificationState}</span>
                  </td>
                  <td className={td}>
                    <DataStatePill state={p.dataState} copy={copy} />
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-muted-foreground`}>{ts(p.lastVerifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>

      <Section title={copy.connections.syncTitle} description={copy.connections.syncDescription}>
        {sync.error && !sync.data ? (
          <AnalyticsState error={sync.error} copy={copy} onRetry={() => sync.mutate()} loginHref={loginHref} />
        ) : !sync.data ? (
          <LoadingRows rows={3} label={copy.common.loading} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={sync.data.ingestionEnabled ? copy.connections.ingestionOn : copy.connections.ingestionOff}
                tone={sync.data.ingestionEnabled ? 'success' : 'muted'}
              />
              <DataStatePill state={sync.data.dataState} copy={copy} />
            </div>
            {!sync.data.ingestionEnabled && (
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.connections.ingestionOffBody}</p>
            )}
            {sync.data.runs.length === 0 ? (
              <EmptyNote>{copy.connections.syncEmpty}</EmptyNote>
            ) : (
              <TableFrame label={copy.connections.syncTitle}>
                <thead>
                  <tr>
                    <th scope="col" className={th}>{copy.connections.provider}</th>
                    <th scope="col" className={th}>{copy.connections.runStatus}</th>
                    <th scope="col" className={th}>{copy.connections.status}</th>
                    <th scope="col" className={th}>{copy.connections.scheduled}</th>
                    <th scope="col" className={th}>{copy.connections.processed}</th>
                    <th scope="col" className={th}>{copy.connections.error}</th>
                  </tr>
                </thead>
                <tbody>
                  {sync.data.runs.map((run, i) => (
                    <tr key={`${run.provider}-${run.scheduledAt}-${i}`} className="border-t">
                      <td className={`${td} font-medium`}>{providerLabel(copy, run.provider)}</td>
                      <td className={td}>
                        <span className="font-mono text-xs text-muted-foreground">{run.status}</span>
                      </td>
                      <td className={td}>
                        <DataStatePill state={run.dataState} copy={copy} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-xs text-muted-foreground`}>{ts(run.scheduledAt)}</td>
                      <td className={`${td} whitespace-nowrap text-xs text-muted-foreground`}>
                        {run.processedAt ? ts(run.processedAt) : copy.connections.pendingRun}
                      </td>
                      <td className={`${td} font-mono text-xs text-muted-foreground`}>{run.errorClass ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            )}
          </div>
        )}
      </Section>
    </>
  )
}
