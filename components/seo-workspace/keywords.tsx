'use client'

import {
  DisconnectedState,
  Facts,
  GapNotice,
  LoadingRows,
  Section,
  StatTile,
  StatusPill,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/crm-ui/workspace'
import { SEO_API, type GscPerformance } from '@/lib/seo-workspace-ui/types'
import type { SeoViewProps } from '@/lib/seo-workspace-ui/server'
import { DATA_TONE, SiteBar, useSelectedSite } from './shared'

export function SeoKeywordsView({ accountId, locale, copy, sites }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const res = useWorkspace<{ gsc: GscPerformance }>(siteId ? SEO_API.performance(siteId) : null, accountId)
  const k = copy.keywords
  const kit = copy.kit
  const gsc = res.data?.gsc

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      {res.isLoading ? (
        <LoadingRows label={kit.loading} rows={3} />
      ) : res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={copy.name} onRetry={() => res.mutate()} />
      ) : gsc?.dataState === 'NOT_CONNECTED' ? (
        <DisconnectedState title={k.notConnectedTitle} body={k.notConnectedBody} />
      ) : gsc ? (
        <>
          {gsc.clicks === null && gsc.impressions === null && <GapNotice title={k.partialTitle} body={k.partialBody} />}
          <Section
            title={k.title}
            description={k.body}
            action={<StatusPill label={enumLabel(copy.dataStates, gsc.dataState)} tone={DATA_TONE[gsc.dataState] ?? 'muted'} />}
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label={k.clicks} value={formatNumber(gsc.clicks, locale)} />
                <StatTile label={k.impressions} value={formatNumber(gsc.impressions, locale)} />
                <StatTile label={k.ctr} value={formatPercent(gsc.ctr, locale)} />
                <StatTile label={k.position} value={formatNumber(gsc.averagePosition, locale, 1)} hint={gsc.averagePositionLabel} />
              </div>
              <Facts
                items={[
                  [k.property, gsc.propertyRef ?? DASH],
                  [k.range, gsc.dateRange ? `${formatDate(gsc.dateRange.start, locale)} – ${formatDate(gsc.dateRange.end, locale)}` : DASH],
                  [k.asOf, formatDateTime(gsc.asOf, locale)],
                  [k.rows, formatNumber(gsc.completeness.rowCount, locale)],
                  [k.deduped, formatNumber(gsc.completeness.dedupedRowCount, locale)],
                  [k.days, formatNumber(gsc.completeness.distinctDates, locale)],
                ]}
              />
              {gsc.completeness.limitations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{k.limitations}</p>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {gsc.completeness.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
          <GapNotice title={k.queriesTitle} body={k.queriesBody} />
        </>
      ) : null}
    </SiteBar>
  )
}
