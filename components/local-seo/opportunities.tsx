'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  EmptyNote,
  LoadingRows,
  Section,
  SelectField,
  StatusPill,
  UnavailableAction,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { enumLabel, formatDateTime, formatNumber, withQuery } from '@/lib/crm-ui/workspace'
import {
  OPPORTUNITY_LEVELS,
  OPPORTUNITY_STATES,
  SEO_API,
  type SeoOpportunitiesResponse,
} from '@/lib/local-seo-ui/types'
import type { SeoViewProps } from '@/lib/local-seo-ui/server'
import { useCursorPages, useRecoverInvalidCursor, useSeoList } from '@/lib/local-seo-ui/use-seo-list'
import { LEVEL_TONE, Pager, SiteBar, useSelectedSite } from './shared'

const TAKE = 25

type Filters = { state: string; severity: string; confidence: string }
const NO_FILTERS: Filters = { state: '', severity: '', confidence: '' }

export function SeoOpportunitiesView({ accountId, locale, copy, sites, marketingBase }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const pages = useCursorPages(`${siteId}|${filters.state}|${filters.severity}|${filters.confidence}`)
  const res = useSeoList<SeoOpportunitiesResponse>(
    siteId,
    siteId
      ? withQuery(SEO_API.opportunities(siteId), {
          take: TAKE,
          cursor: pages.cursor,
          state: filters.state || undefined,
          severity: filters.severity || undefined,
          confidence: filters.confidence || undefined,
        })
      : null,
    accountId,
  )
  useRecoverInvalidCursor(res.error, !!pages.cursor, pages.first)
  const o = copy.opportunities
  const kit = copy.kit
  const filtered = filters.state !== '' || filters.severity !== '' || filters.confidence !== ''
  const items = res.data?.opportunities ?? []

  const levelOptions = [{ value: '', label: o.all }, ...OPPORTUNITY_LEVELS.map((v) => ({ value: v, label: enumLabel(copy.level, v) }))]
  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      <Section title={o.title} description={o.body}>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label={o.state}
              value={filters.state}
              onChange={set('state')}
              options={[{ value: '', label: o.all }, ...OPPORTUNITY_STATES.map((v) => ({ value: v, label: enumLabel(copy.opportunityState, v) }))]}
            />
            <SelectField label={o.severity} value={filters.severity} onChange={set('severity')} options={levelOptions} />
            <SelectField label={o.confidence} value={filters.confidence} onChange={set('confidence')} options={levelOptions} />
          </div>
          {filtered && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                {o.clearFilters}
              </Button>
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{o.stageNote}</p>

          {res.isLoading ? (
            <LoadingRows label={kit.loading} rows={4} />
          ) : res.error ? (
            <WorkspaceState error={res.error} kit={kit} workspace={copy.name} compact onRetry={() => res.mutate()} />
          ) : !items.length ? (
            <EmptyNote>{filtered ? o.noMatches : o.none}</EmptyNote>
          ) : (
            <ul
              aria-busy={res.isRefreshing}
              className={`flex flex-col divide-y divide-border ${res.isRefreshing ? 'opacity-60 transition-opacity' : ''}`}
            >
              {items.map((op) => {
                const observedOnly = op.state === 'OBSERVED_FINDING'
                return (
                  <li key={op.id} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={enumLabel(copy.opportunityState, op.state)} tone={observedOnly ? 'muted' : 'info'} />
                      <StatusPill label={`${o.severity}: ${enumLabel(copy.level, op.severity)}`} tone={LEVEL_TONE[op.severity] ?? 'muted'} />
                      <StatusPill label={`${o.confidence}: ${enumLabel(copy.level, op.confidence)}`} tone="muted" />
                      <StatusPill label={`${o.effort}: ${enumLabel(copy.effort, op.effortCategory)}`} tone="muted" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {observedOnly ? o.observedTitle : o.recommendation}
                        </p>
                        <p className="text-sm font-medium leading-relaxed text-pretty">{op.recommendation}</p>
                      </div>
                      {op.impactRationale && (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{o.impact}</p>
                          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{op.impactRationale}</p>
                        </div>
                      )}
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {op.affectedUrl && (
                          <div className="flex gap-1 sm:col-span-2">
                            <dt className="font-medium">{o.page}:</dt>
                            <dd className="break-all">{op.affectedUrl}</dd>
                          </div>
                        )}
                        <div className="flex gap-1">
                          <dt className="font-medium">{o.source}:</dt>
                          <dd>{op.source}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="font-medium">{o.observedAt}:</dt>
                          <dd>{formatDateTime(op.observedAt, locale)}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="font-medium">{o.priority}:</dt>
                          <dd className="tabular-nums">{formatNumber(op.priorityScore, locale)}</dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="font-medium">{o.rule}:</dt>
                          <dd className="break-all">
                            {op.ruleId}
                            {op.ruleVersion ? ` v${op.ruleVersion}` : ''}
                          </dd>
                        </div>
                        {op.evidenceRef && (
                          <div className="flex gap-1 sm:col-span-2">
                            <dt className="font-medium">{o.evidence}:</dt>
                            <dd className="break-all font-mono">{op.evidenceRef}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="flex flex-col gap-1 sm:max-w-sm">
                        <Link
                          className={`${buttonVariants({ variant: 'outline', size: 'sm' })} self-start`}
                          href={withQuery(`${marketingBase}/requests`, { site: siteId, seoOpportunityId: op.id })}
                        >
                          {o.request}
                        </Link>
                        <p className="text-xs leading-relaxed text-muted-foreground">{o.requestNote}</p>
                      </div>
                      <UnavailableAction label={o.executeUnavailable} reason={o.executeReason} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {!res.error && (
            <Pager
              copy={copy}
              page={pages.page}
              hasPrevious={pages.hasPrevious}
              nextCursor={res.data?.nextCursor}
              isRefreshing={res.isRefreshing}
              onFirst={pages.first}
              onPrevious={pages.previous}
              onNext={pages.next}
              noMore={o.noMore}
            />
          )}
        </div>
      </Section>
    </SiteBar>
  )
}
