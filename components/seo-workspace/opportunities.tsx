'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  EmptyNote,
  LoadingRows,
  Section,
  StatusPill,
  UnavailableAction,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDateTime, formatNumber, withQuery } from '@/lib/crm-ui/workspace'
import { SEO_API, type SeoOpportunity } from '@/lib/seo-workspace-ui/types'
import type { SeoViewProps } from '@/lib/seo-workspace-ui/server'
import { LEVEL_TONE, SiteBar, useSelectedSite } from './shared'

const TAKE = 50

export function SeoOpportunitiesView({ accountId, locale, copy, sites, marketingBase }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const res = useWorkspace<{ opportunities: SeoOpportunity[] }>(
    siteId ? withQuery(SEO_API.opportunities(siteId), { take: TAKE }) : null,
    accountId,
  )
  const o = copy.opportunities
  const kit = copy.kit

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      <Section title={o.title} description={o.body}>
        {res.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : res.error ? (
          <WorkspaceState error={res.error} kit={kit} workspace={copy.name} compact onRetry={() => res.mutate()} />
        ) : !res.data?.opportunities.length ? (
          <EmptyNote>{o.none}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{o.requestNote}</p>
            <ul className="flex flex-col divide-y divide-border">
              {res.data.opportunities.map((op) => (
                <li key={op.id} className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={`${o.severity}: ${enumLabel(copy.level, op.severity)}`} tone={LEVEL_TONE[op.severity] ?? 'muted'} />
                    <StatusPill label={`${o.confidence}: ${enumLabel(copy.level, op.confidence)}`} tone="muted" />
                    <StatusPill label={`${o.effort}: ${enumLabel(copy.effort, op.effortCategory)}`} tone="muted" />
                    <StatusPill label={enumLabel(copy.opportunityState, op.state)} tone="info" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium leading-relaxed text-pretty">{op.recommendation}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{op.impactRationale}</p>
                    {op.affectedUrl && (
                      <p className="break-all text-xs text-muted-foreground">
                        {o.page}: {op.affectedUrl}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {o.priority} {formatNumber(op.priorityScore, locale)} · {op.source} · {formatDateTime(op.observedAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-3">
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={withQuery(`${marketingBase}/requests`, { site: siteId, seoOpportunityId: op.id })}>{o.request}</Link>
                    <UnavailableAction label={o.executeUnavailable} reason={o.executeReason} />
                  </div>
                </li>
              ))}
            </ul>
            {res.data.opportunities.length >= TAKE && (
              <p className="text-xs text-muted-foreground">{fill(kit.listCapped, { count: TAKE })}</p>
            )}
          </div>
        )}
      </Section>
    </SiteBar>
  )
}
