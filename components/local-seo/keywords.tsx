'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EmptyNote,
  Facts,
  LoadingRows,
  PlainTable,
  Section,
  StatusPill,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { DASH, enumLabel, fill, formatDateTime, formatNumber, formatPercent, withQuery } from '@/lib/crm-ui/workspace'
import { SEO_API, type GscKeywordsResponse } from '@/lib/local-seo-ui/types'
import type { SeoViewProps } from '@/lib/local-seo-ui/server'
import { formatDay } from '@/lib/local-seo-ui/format'
import { useCursorPages, useSeoList } from '@/lib/local-seo-ui/use-seo-list'
import { DATA_TONE, GscPanel, Pager, SiteBar, useDebounced, useSelectedSite } from './shared'

const TAKE = 50

export function SeoKeywordsView({ accountId, locale, copy, sites, base }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const pages = useCursorPages(`${siteId}|${q}`)
  const res = useSeoList<GscKeywordsResponse>(
    siteId,
    siteId ? withQuery(SEO_API.keywords(siteId), { take: TAKE, q: q || undefined, cursor: pages.cursor }) : null,
    accountId,
  )
  const k = copy.keywords
  const kit = copy.kit
  const gsc = res.data?.gsc
  const rows = res.data?.keywords ?? []
  const connectionsHref = `${base}/connections?site=${siteId}`
  const n = (v: number | null) => (v === null ? DASH : formatNumber(v, locale))

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      {res.isLoading && !gsc ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : res.error && !gsc ? (
        <WorkspaceState error={res.error} kit={kit} workspace={copy.name} onRetry={() => res.mutate()} />
      ) : gsc ? (
        <>
          <GscPanel gsc={gsc} copy={copy} locale={locale} connectionsHref={connectionsHref} description={k.totalsBody} />
          {gsc.completeness && gsc.dataState !== 'NOT_CONNECTED' && (
            <Facts
              items={[
                [k.property, gsc.propertyRef ?? DASH],
                [k.rows, formatNumber(gsc.completeness.rowCount, locale)],
                [k.deduped, formatNumber(gsc.completeness.dedupedRowCount, locale)],
                [k.days, formatNumber(gsc.completeness.distinctDates, locale)],
              ]}
            />
          )}

          {gsc.dataState !== 'NOT_CONNECTED' && (
            <Section title={k.title} description={k.body}>
              <div className="flex flex-col gap-4">
                <form role="search" className="flex flex-col gap-1.5" onSubmit={(e) => e.preventDefault()}>
                  <Label htmlFor="seo-keyword-search">{k.searchLabel}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="seo-keyword-search"
                      type="search"
                      value={search}
                      placeholder={k.searchPlaceholder}
                      maxLength={200}
                      onChange={(e) => setSearch(e.target.value)}
                      className="sm:max-w-sm"
                    />
                    {search && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSearch('')}>
                        <X className="size-4" aria-hidden="true" />
                        <span className="sr-only">{k.clearSearch}</span>
                      </Button>
                    )}
                  </div>
                </form>

                {res.error ? (
                  <WorkspaceState error={res.error} kit={kit} workspace={copy.name} compact onRetry={() => res.mutate()} />
                ) : !rows.length ? (
                  <EmptyNote>{q ? fill(k.noMatches, { q }) : k.none}</EmptyNote>
                ) : (
                  <div aria-busy={res.isRefreshing} className={res.isRefreshing ? 'opacity-60 transition-opacity' : undefined}>
                    <PlainTable
                      label={k.title}
                      headers={[k.query, k.page, k.clicks, k.impressions, k.ctr, k.position, k.day, k.observed, k.status]}
                    >
                      {rows.map((r) => (
                        <tr key={`${r.query}|${r.page ?? ''}|${r.date}`}>
                          <td className={`${td} font-medium`}>{r.query}</td>
                          <td className={`${td} max-w-64 break-all text-muted-foreground`}>{r.page ?? k.sitewide}</td>
                          <td className={`${td} tabular-nums`}>{n(r.clicks)}</td>
                          <td className={`${td} tabular-nums`}>{n(r.impressions)}</td>
                          <td className={`${td} tabular-nums`}>{r.ctr === null ? DASH : formatPercent(r.ctr, locale)}</td>
                          <td className={`${td} tabular-nums`}>
                            {r.averagePosition === null ? DASH : formatNumber(r.averagePosition, locale, 1)}
                          </td>
                          <td className={`${td} whitespace-nowrap`}>{formatDay(r.date, locale)}</td>
                          <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.observedAt, locale)}</td>
                          <td className={td}>
                            <StatusPill label={enumLabel(copy.dataStates, r.dataState)} tone={DATA_TONE[r.dataState] ?? 'muted'} />
                          </td>
                        </tr>
                      ))}
                    </PlainTable>
                  </div>
                )}

                <Pager
                  copy={copy}
                  page={pages.page}
                  hasPrevious={pages.hasPrevious}
                  nextCursor={res.data?.nextCursor}
                  isRefreshing={res.isRefreshing}
                  onFirst={pages.first}
                  onPrevious={pages.previous}
                  onNext={pages.next}
                  noMore={k.noMore}
                />
              </div>
            </Section>
          )}
        </>
      ) : null}
    </SiteBar>
  )
}
