'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  EmptyNote,
  Facts,
  GapNotice,
  LoadingRows,
  PlainTable,
  Section,
  StatTile,
  StatusPill,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import { SEO_API, type SeoOverview } from '@/lib/seo-workspace-ui/types'
import type { SeoViewProps } from '@/lib/seo-workspace-ui/server'
import { DATA_TONE, LEVEL_TONE, SiteBar, useSelectedSite } from './shared'

export function SeoOverviewView({ accountId, locale, copy, base, sites }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const res = useWorkspace<{ overview: SeoOverview }>(siteId ? SEO_API.overview(siteId) : null, accountId)
  const o = copy.overview
  const kit = copy.kit
  const q = `?site=${siteId}`

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      {res.isLoading ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={copy.name} onRetry={() => res.mutate()} />
      ) : res.data ? (
        <OverviewBody data={res.data.overview} props={{ locale, copy, base, q }} />
      ) : null}
    </SiteBar>
  )
}

function OverviewBody({
  data,
  props: { locale, copy, base, q },
}: {
  data: SeoOverview
  props: { locale: string; copy: SeoViewProps['copy']; base: string; q: string }
}) {
  const o = copy.overview
  const s = data.sections
  const n = (v: number) => formatNumber(v, locale)

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={o.healthTitle}
        description={o.healthBody}
        action={<StatusPill label={enumLabel(copy.dataStates, s.overview.dataState)} tone={DATA_TONE[s.overview.dataState] ?? 'muted'} />}
      >
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              [o.host, data.canonicalHost ?? DASH],
              [o.lastObserved, formatDateTime(s.overview.lastObservedAt, locale)],
            ]}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile label={o.published} value={n(s.pageCounts.published)} />
            <StatTile label={o.discovered} value={n(s.pageCounts.discovered)} />
            <StatTile label={o.unverified} value={n(s.pageCounts.unverified)} />
            <StatTile label={o.findings} value={n(s.technicalFindings.count)} />
            <StatTile label={o.outstanding} value={n(s.outstandingActions.count)} />
            <StatTile label={o.workPerformed} value={n(s.workPerformed.count)} />
          </div>
        </div>
      </Section>

      <GapNotice title={o.searchTitle} body={o.searchBody} />
      <div>
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${base}/keywords${q}`}>{o.openSearch}</Link>
      </div>

      <Section title={o.freshnessTitle}>
        {!s.sourceFreshness.providers.length ? (
          <EmptyNote>{o.noProviders}</EmptyNote>
        ) : (
          <PlainTable label={o.freshnessTitle} headers={[o.provider, o.state, o.observed]}>
            {s.sourceFreshness.providers.map((p) => (
              <tr key={p.provider}>
                <td className={td}>{p.provider}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.dataStates, p.dataState)} tone={DATA_TONE[p.dataState] ?? 'muted'} />
                </td>
                <td className={td}>{formatDateTime(p.observedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>

      <Section
        title={o.opportunitiesTitle}
        action={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${base}/opportunities${q}`}>{o.viewAll}</Link>
        }
      >
        {!s.priorityOpportunities.length ? (
          <EmptyNote>{o.noOpportunities}</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {s.priorityOpportunities.map((op) => (
              <li key={`${op.ruleId}-${op.evidenceRef}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-relaxed text-pretty">{op.recommendation}</p>
                  {op.affectedUrl && <p className="break-all text-xs text-muted-foreground">{op.affectedUrl}</p>}
                </div>
                <StatusPill label={enumLabel(copy.level, op.severity)} tone={LEVEL_TONE[op.severity] ?? 'muted'} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={o.competitorsTitle}
        action={
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${base}/local-market${q}`}>{o.viewAll}</Link>
        }
      >
        {!s.competitorMarket.competitors.length ? (
          <EmptyNote>{o.noCompetitors}</EmptyNote>
        ) : (
          <PlainTable label={o.competitorsTitle} headers={[copy.local.competitor, copy.local.score, copy.local.source]}>
            {s.competitorMarket.competitors.map((c) => (
              <tr key={`${c.displayName}-${c.placeId ?? ''}`}>
                <td className={td}>{c.displayName}</td>
                <td className={td}>{formatNumber(c.rankScore, locale, 2)}</td>
                <td className={td}>{c.source}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}
