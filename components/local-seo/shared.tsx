'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DisconnectedState,
  Facts,
  GapNotice,
  Section,
  SiteSelector,
  StatTile,
  StatusPill,
  type PillTone,
} from '@/components/crm/workspace-kit'
import { enumLabel, fill, formatDateTime, formatNumber, formatPercent } from '@/lib/crm-ui/workspace'
import type { ManagedSiteOption, WorkspaceKitCopy } from '@/lib/crm-ui/workspace'
import type { SeoViewProps } from '@/lib/local-seo-ui/server'
import type { GscPerformance, GscSummary } from '@/lib/local-seo-ui/types'
import { formatDayRange } from '@/lib/local-seo-ui/format'
import { mergeGscLimitationMessages } from '@/lib/local-seo-ui/limitations'

type SeoCopy = SeoViewProps['copy']

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function gscNotice(gsc: GscSummary, g: SeoCopy['gsc']): { title: string; body: string } | null {
  switch (gsc.dataState) {
    case 'PARTIAL':
      return { title: g.partialTitle, body: g.partialBody }
    case 'STALE':
      return { title: g.staleTitle, body: g.staleBody }
    case 'ERROR':
      return { title: g.errorTitle, body: g.errorBody }
  }
  const allMissing = gsc.clicks === null && gsc.impressions === null && gsc.ctr === null && gsc.averagePosition === null
  return allMissing ? { title: g.emptyTitle, body: g.emptyBody } : null
}

/**
 * Stored GSC totals with honest states. Null metrics render as "Not available", never as zero, and the
 * average position is always labelled as a Search Console average rather than a rank or map-pack position.
 */
export function GscPanel({
  gsc,
  copy,
  locale,
  connectionsHref,
  description,
  action,
  responseLimitations,
}: {
  gsc: GscSummary | GscPerformance
  copy: SeoCopy
  locale: string
  connectionsHref: string
  description?: string
  action?: React.ReactNode
  /** Keywords API top-level limitations (property attribution, snapshot scope). */
  responseLimitations?: string[]
}) {
  const g = copy.gsc
  if (gsc.dataState === 'NOT_CONNECTED') {
    return (
      <div className="flex flex-col gap-3">
        <DisconnectedState title={g.notConnectedTitle} body={g.notConnectedBody} />
        <div>
          <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={connectionsHref}>
            {g.openConnections}
          </Link>
        </div>
      </div>
    )
  }

  const notice = gscNotice(gsc, g)
  const metric = (text: string, value: number | null) => (value === null ? g.unavailable : text)
  const details = 'completeness' in gsc ? gsc : null
  const limitations = mergeGscLimitationMessages(details ?? undefined, responseLimitations)

  return (
    <Section
      title={g.title}
      description={description ?? g.body}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={enumLabel(copy.dataStates, gsc.dataState)} tone={DATA_TONE[gsc.dataState] ?? 'muted'} />
          {action}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {notice && <GapNotice title={notice.title} body={notice.body} />}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={g.clicks} value={metric(formatNumber(gsc.clicks, locale), gsc.clicks)} />
          <StatTile label={g.impressions} value={metric(formatNumber(gsc.impressions, locale), gsc.impressions)} />
          <StatTile label={g.ctr} value={metric(formatPercent(gsc.ctr, locale), gsc.ctr)} />
          <StatTile
            label={g.position}
            value={metric(formatNumber(gsc.averagePosition, locale, 1), gsc.averagePosition)}
            hint={g.positionHint}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{g.positionHelp}</p>
        <Facts
          items={[
            [g.range, formatDayRange(gsc.dateRange, locale)],
            ...(details ? ([[g.asOf, formatDateTime(details.asOf, locale)]] as [string, string][]) : []),
          ]}
        />
        {limitations.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{g.provenanceTitle}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{g.provenanceBody}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

export function Pager({
  copy,
  page,
  hasPrevious,
  nextCursor,
  isRefreshing,
  onFirst,
  onPrevious,
  onNext,
  noMore,
}: {
  copy: SeoCopy
  page: number
  hasPrevious: boolean
  nextCursor?: string
  isRefreshing: boolean
  onFirst: () => void
  onPrevious: () => void
  onNext: (cursor: string) => void
  noMore: string
}) {
  const p = copy.pager
  if (!hasPrevious && !nextCursor) return null
  return (
    <nav aria-label={p.label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {fill(p.page, { page })}
        {isRefreshing ? ` · ${p.updating}` : ''}
        {!nextCursor ? ` · ${noMore}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {page > 2 && (
          <Button variant="ghost" size="sm" onClick={onFirst} disabled={isRefreshing}>
            {p.first}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPrevious || isRefreshing}>
          {p.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => nextCursor && onNext(nextCursor)}
          disabled={!nextCursor || isRefreshing}
        >
          {p.next}
        </Button>
      </div>
    </nav>
  )
}

export const DATA_TONE: Record<string, PillTone> = {
  NOT_CONNECTED: 'muted',
  FETCHING: 'info',
  READY: 'success',
  PARTIAL: 'neutral',
  STALE: 'neutral',
  ERROR: 'danger',
  NOT_SUPPORTED: 'muted',
}

export const LEVEL_TONE: Record<string, PillTone> = { LOW: 'muted', MEDIUM: 'neutral', HIGH: 'danger' }

/** The selected site lives in `?site=` so every SEO section keeps the same site while navigating. */
export function useSelectedSite(sites: ManagedSiteOption[]): string {
  const requested = useSearchParams().get('site')
  return requested && sites.some((s) => s.id === requested) ? requested : (sites[0]?.id ?? '')
}

export function SiteBar({
  sites,
  siteId,
  kit,
  children,
}: {
  sites: ManagedSiteOption[]
  siteId: string
  kit: WorkspaceKitCopy
  children: React.ReactNode
}) {
  if (!sites.length) return <DisconnectedState title={kit.noSites.title} body={kit.noSites.body} />
  return (
    <div className="flex flex-col gap-6">
      <SiteSelector sites={sites} selectedId={siteId} label={kit.siteLabel} />
      {children}
    </div>
  )
}
