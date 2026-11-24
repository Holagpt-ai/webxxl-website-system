'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyNote, LoadingRows, PlainTable, Section, WorkspaceState, td } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, fill, formatDateTime, formatNumber, formatPercent, withQuery } from '@/lib/crm-ui/workspace'
import type { SeoViewProps } from '@/lib/local-seo-ui/server'
import { seoIntegrationCopy } from '@/lib/integration-ui/seo-copy'

const sitePath = (siteId: string) => `/api/v1/seo/sites/${encodeURIComponent(siteId)}`

type Kit = SeoViewProps['copy']['kit']
type PanelProps = { siteId: string; accountId: string; locale: string; kit: Kit; workspace: string }

type HandoffContract = {
  assessedAt: string
  oauthConnectionEnabled: false
  oauthStartDeferredReason: string
  providers: Array<{ provider: string; readinessState: string; oauthStartAvailable: false; blockedReason?: string }>
  limitations: string[]
}

export function GoogleHandoffPanel({ siteId, accountId, locale, kit, workspace }: PanelProps) {
  const t = seoIntegrationCopy(locale).google
  const res = useWorkspace<HandoffContract>(`${sitePath(siteId)}/google/oauth-handoff`, accountId)
  return (
    <Section title={t.title} description={t.body}>
      {res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={workspace} compact onRetry={() => res.mutate()} />
      ) : !res.data ? (
        <LoadingRows label={kit.loading} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled aria-describedby={`${siteId}-google-reason`}>
              {t.connectLabel}
            </Button>
            <p id={`${siteId}-google-reason`} className="min-w-0 text-sm leading-relaxed text-muted-foreground">
              {t.connectReason}
            </p>
          </div>
          {res.data.providers.length === 0 ? (
            <EmptyNote>{t.none}</EmptyNote>
          ) : (
            <PlainTable label={t.title} headers={[t.provider, t.readiness, t.blocked]}>
              {res.data.providers.map((p) => (
                <tr key={p.provider}>
                  <td className={td}>{p.provider}</td>
                  <td className={td}>{p.readinessState}</td>
                  <td className={`${td} break-words`}>{p.blockedReason ?? DASH}</td>
                </tr>
              ))}
            </PlainTable>
          )}
          <p className="text-xs text-muted-foreground">
            {t.assessed}: {formatDateTime(res.data.assessedAt, locale)}
          </p>
          <Limitations title={t.limitations} items={res.data.limitations} />
        </div>
      )}
    </Section>
  )
}

type CrawlRun = {
  id: string
  status: string
  operation: string
  maxPages: number
  maxDepth: number
  pagesCrawled: number
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  createdAt: string
}
type CrawlRunDetail = CrawlRun & { findingsCount: number; inventoryPagesTouched: number; message: string }

export function CrawlRunsPanel({ siteId, accountId, locale, kit, workspace }: PanelProps) {
  const t = seoIntegrationCopy(locale).crawl
  const res = useWorkspace<{ crawlRuns: CrawlRun[] }>(`${sitePath(siteId)}/crawl-runs`, accountId)
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <Section title={t.title} description={t.body}>
      {res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={workspace} compact onRetry={() => res.mutate()} />
      ) : !res.data ? (
        <LoadingRows label={kit.loading} />
      ) : res.data.crawlRuns.length === 0 ? (
        <EmptyNote>{t.none}</EmptyNote>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {res.data.crawlRuns.map((run) => {
            const open = openId === run.id
            return (
              <li key={run.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <Field label={t.status} value={run.status} />
                    <Field label={t.operation} value={run.operation} />
                    <Field label={t.pages} value={formatNumber(run.pagesCrawled, locale)} />
                    <Field label={t.started} value={formatDateTime(run.startedAt ?? run.createdAt, locale)} />
                  </dl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-expanded={open}
                    aria-controls={`crawl-${run.id}`}
                    onClick={() => setOpenId(open ? null : run.id)}
                  >
                    {open ? t.close : t.open}
                  </Button>
                </div>
                {open && <CrawlRunDetailView id={`crawl-${run.id}`} runId={run.id} {...{ siteId, accountId, locale, kit, workspace }} />}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function CrawlRunDetailView({ id, runId, siteId, accountId, locale, kit, workspace }: PanelProps & { id: string; runId: string }) {
  const t = seoIntegrationCopy(locale).crawl
  const res = useWorkspace<CrawlRunDetail>(`${sitePath(siteId)}/crawl-runs/${encodeURIComponent(runId)}`, accountId)
  return (
    <div id={id} className="rounded-md bg-muted/50 p-3">
      {res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={workspace} compact onRetry={() => res.mutate()} />
      ) : !res.data ? (
        <LoadingRows label={kit.loading} />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Field label={t.findings} value={formatNumber(res.data.findingsCount, locale)} />
          <Field label={t.touched} value={formatNumber(res.data.inventoryPagesTouched, locale)} />
          <Field
            label={t.limits}
            value={fill(t.limitsValue, { pages: res.data.maxPages, depth: res.data.maxDepth })}
          />
          <Field label={t.finished} value={formatDateTime(res.data.finishedAt, locale)} />
          <Field label={t.error} value={res.data.errorCode ?? DASH} />
          <div className="col-span-2 min-w-0 sm:col-span-3">
            <dt className="text-xs text-muted-foreground">{t.message}</dt>
            <dd className="break-words leading-relaxed">{res.data.message || DASH}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

type KeywordIntel = {
  query: string
  dataState: string
  measuredAt: string | null
  gsc: { clicks: number | null; impressions: number | null; ctr: number | null; averagePosition: number | null }
  observations: Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>
  limitations: string[]
}

export function KeywordLookupPanel({ siteId, accountId, locale, kit, workspace }: PanelProps) {
  const t = seoIntegrationCopy(locale).keyword
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const res = useWorkspace<KeywordIntel>(
    query ? withQuery(`${sitePath(siteId)}/keywords/intelligence`, { query }) : null,
    accountId,
  )
  return (
    <Section title={t.title} description={t.body}>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(draft.trim())
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t.query}
          </label>
          <Input
            id={inputId}
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            aria-describedby={`${inputId}-hint`}
          />
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {t.queryHint}
          </p>
        </div>
        <Button type="submit" disabled={!draft.trim()} className="sm:mb-5">
          {t.submit}
        </Button>
      </form>
      {query && (
        <div className="mt-4 flex flex-col gap-4" aria-live="polite">
          {res.error ? (
            <WorkspaceState error={res.error} kit={kit} workspace={workspace} compact onRetry={() => res.mutate()} />
          ) : !res.data ? (
            <LoadingRows label={kit.loading} />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Field label={t.clicks} value={formatNumber(res.data.gsc.clicks, locale)} />
                <Field label={t.impressions} value={formatNumber(res.data.gsc.impressions, locale)} />
                <Field label={t.ctr} value={formatPercent(res.data.gsc.ctr, locale)} />
                <Field label={t.position} value={formatNumber(res.data.gsc.averagePosition, locale, 1)} />
                <Field label={t.dataState} value={res.data.dataState} />
                <Field label={t.measured} value={formatDateTime(res.data.measuredAt, locale)} />
              </dl>
              {res.data.observations.length === 0 ? (
                <EmptyNote>{t.noObservations}</EmptyNote>
              ) : (
                <PlainTable label={t.observations} headers={[t.page, t.clicks, t.impressions, t.position]}>
                  {res.data.observations.map((o, i) => (
                    <tr key={`${o.page}-${i}`}>
                      <td className={`${td} break-all`}>{o.page}</td>
                      <td className={td}>{formatNumber(o.clicks, locale)}</td>
                      <td className={td}>{formatNumber(o.impressions, locale)}</td>
                      <td className={td}>{formatNumber(o.position, locale, 1)}</td>
                    </tr>
                  ))}
                </PlainTable>
              )}
              <Limitations title={t.limitations} items={res.data.limitations} />
            </>
          )}
        </div>
      )}
    </Section>
  )
}

type CompetitorIntel = {
  signals: { categoryMatch: number | null; serviceOverlap: number | null; geoRelevance: number | null }
  observations: Array<{ id: string; observationKind: string; observedAt: string }>
  localRank: { dataState: 'NOT_CONNECTED'; limitations: string[] }
  measuredAt: string | null
}

export function CompetitorDetailToggle({
  competitorId,
  siteId,
  accountId,
  locale,
  kit,
  workspace,
}: PanelProps & { competitorId: string }) {
  const t = seoIntegrationCopy(locale).competitor
  const [open, setOpen] = useState(false)
  const regionId = `competitor-${competitorId}`
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t.close : t.open}
      </Button>
      {open && <CompetitorDetail id={regionId} {...{ competitorId, siteId, accountId, locale, kit, workspace }} />}
    </div>
  )
}

function CompetitorDetail({ id, competitorId, siteId, accountId, locale, kit, workspace }: PanelProps & { id: string; competitorId: string }) {
  const t = seoIntegrationCopy(locale).competitor
  const res = useWorkspace<CompetitorIntel>(
    `${sitePath(siteId)}/competitors/${encodeURIComponent(competitorId)}`,
    accountId,
  )
  return (
    <div id={id} className="w-full min-w-64 rounded-md bg-muted/50 p-3 text-sm">
      {res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={workspace} compact onRetry={() => res.mutate()} />
      ) : !res.data ? (
        <LoadingRows label={kit.loading} />
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-3 gap-2">
            <Field label={t.category} value={formatNumber(res.data.signals.categoryMatch, locale, 2)} />
            <Field label={t.service} value={formatNumber(res.data.signals.serviceOverlap, locale, 2)} />
            <Field label={t.geo} value={formatNumber(res.data.signals.geoRelevance, locale, 2)} />
          </dl>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium">{t.observations}</p>
            {res.data.observations.length === 0 ? (
              <p className="text-muted-foreground">{t.noObservations}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {res.data.observations.map((o) => (
                  <li key={o.id} className="flex flex-wrap justify-between gap-2">
                    <span className="min-w-0 break-words">{o.observationKind}</span>
                    <span className="text-muted-foreground">{formatDateTime(o.observedAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{t.localRank}: </span>
            {t.localRankNotConnected}
          </p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}

function Limitations({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p className="font-medium">{title}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-4">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
