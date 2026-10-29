'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, StatusPill, td } from '@/components/commerce/ui'
import { GapNotice, PlainTable, SectionHeading, SelectField, WorkspaceState } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, isGateError, withQuery, type WorkspaceError } from '@/lib/crm-ui/workspace'
import {
  ARTIFACT_REVIEW_STATUSES,
  ARTIFACT_TYPES,
  MKT_API,
  MKT_PAGE_SIZE,
  type MarketingArtifact,
  type MarketingArtifactListResponse,
  type MarketingRequest,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { useCursorPages } from '@/lib/marketing-studio-ui/use-cursor-pages'
import { REVIEW_TONE, siteLabel } from './shared'

const DASH = '—'

export function MarketingDeliverables(props: MarketingViewProps) {
  const { accountId, copy, locale, base, sites } = props
  const d = copy.deliverables
  const kit = copy.kit
  const [artifactType, setArtifactType] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [managedSiteId, setManagedSiteId] = useState('')
  const filterKey = `${artifactType}|${reviewStatus}|${managedSiteId}`
  const paging = useCursorPages(filterKey)
  const [staleReset, setStaleReset] = useState(false)

  const url = withQuery(MKT_API.artifacts, {
    take: MKT_PAGE_SIZE,
    cursor: paging.cursor,
    artifactType: artifactType || undefined,
    reviewStatus: reviewStatus || undefined,
    managedSiteId: managedSiteId || undefined,
  })
  const list = useWorkspace<MarketingArtifactListResponse>(url, accountId)
  const { first } = paging

  useEffect(() => {
    if (paging.cursor && isStaleCursor(list.error)) {
      setStaleReset(true)
      first()
    }
  }, [list.error, paging.cursor, first])

  const filtered = Boolean(artifactType || reviewStatus || managedSiteId)
  const rows = list.data?.artifacts ?? []

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={d.title} description={d.description} />
      <div role="group" aria-label={d.filtersLabel} className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={d.filterType}
          value={artifactType}
          onChange={(v) => {
            setStaleReset(false)
            setArtifactType(v)
          }}
          options={[{ value: '', label: d.allTypes }, ...ARTIFACT_TYPES.map((v) => ({ value: v, label: enumLabel(copy.enums.artifactType, v) }))]}
        />
        <SelectField
          label={d.filterStatus}
          value={reviewStatus}
          onChange={(v) => {
            setStaleReset(false)
            setReviewStatus(v)
          }}
          options={[
            { value: '', label: d.allStatuses },
            ...ARTIFACT_REVIEW_STATUSES.map((v) => ({ value: v, label: enumLabel(copy.enums.reviewStatus, v) })),
          ]}
        />
        {sites.length > 0 && (
          <SelectField
            label={d.filterSite}
            value={managedSiteId}
            onChange={(v) => {
              setStaleReset(false)
              setManagedSiteId(v)
            }}
            options={[{ value: '', label: d.allSites }, ...sites.map((s) => ({ value: s.id, label: s.domain ?? s.name }))]}
          />
        )}
      </div>
      {filtered && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setArtifactType('')
              setReviewStatus('')
              setManagedSiteId('')
            }}
          >
            {d.resetFilters}
          </Button>
        </div>
      )}
      {staleReset && <GapNotice title={copy.paging.staleTitle} body={copy.paging.staleBody} />}
      <p className="text-sm leading-relaxed text-muted-foreground">{d.statusNote}</p>

      {list.isLoading ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : list.error && !(paging.cursor && isStaleCursor(list.error)) ? (
        <WorkspaceState
          error={list.error}
          kit={kit}
          workspace={copy.name}
          compact={!isGateError(list.error)}
          onRetry={() => list.mutate()}
        />
      ) : !rows.length ? (
        <EmptyNote>{filtered ? d.emptyFiltered : d.empty}</EmptyNote>
      ) : (
        <>
          <PlainTable label={d.listLabel} headers={[d.type, d.review, d.generation, d.site, d.language, d.request, d.created]}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className={`${td} font-medium text-foreground`}>
                  <Link href={`${base}/deliverables/${a.id}`} className="underline-offset-4 hover:underline">
                    {enumLabel(copy.enums.artifactType, a.artifactType)}
                  </Link>
                </td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.reviewStatus, a.reviewStatus)} tone={REVIEW_TONE[a.reviewStatus] ?? 'muted'} />
                </td>
                <td className={td}>{enumLabel(copy.enums.generation, a.generationMode)}</td>
                <td className={td}>{siteLabel(sites, a.managedSiteId, d.noSite)}</td>
                <td className={td}>{enumLabel(copy.enums.locale, a.locale)}</td>
                <td className={td}>
                  {a.marketingRequestId ? (
                    <Link href={`${base}/requests/${a.marketingRequestId}`} className="underline-offset-4 hover:underline">
                      {d.openRequest}
                    </Link>
                  ) : (
                    DASH
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(a.createdAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
          <CursorPager copy={copy} paging={paging} nextCursor={list.data?.nextCursor} onMove={() => setStaleReset(false)} />
        </>
      )}
    </div>
  )
}

/** The list routes reject an expired or foreign cursor with a 400; anything else is a real error. */
export function isStaleCursor(error: WorkspaceError | null | undefined): boolean {
  return Boolean(error && (error.status === 400 || error.kind === 'VALIDATION'))
}

export function CursorPager({
  copy,
  paging,
  nextCursor,
  onMove,
}: {
  copy: MarketingViewProps['copy']
  paging: ReturnType<typeof useCursorPages>
  nextCursor?: string
  onMove?: () => void
}) {
  const p = copy.paging
  if (!paging.hasPrevious && !nextCursor) {
    return <p className="text-xs text-muted-foreground">{fill(p.pageSize, { count: String(MKT_PAGE_SIZE) })}</p>
  }
  return (
    <nav aria-label={p.label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {fill(p.page, { page: String(paging.page) })} · {fill(p.pageSize, { count: String(MKT_PAGE_SIZE) })}
      </p>
      <div className="flex items-center gap-2">
        {paging.page > 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onMove?.()
              paging.first()
            }}
          >
            {p.first}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!paging.hasPrevious}
          onClick={() => {
            onMove?.()
            paging.previous()
          }}
        >
          {p.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextCursor}
          onClick={() => {
            if (!nextCursor) return
            onMove?.()
            paging.next(nextCursor)
          }}
        >
          {p.next}
        </Button>
      </div>
    </nav>
  )
}

export function ArtifactsTable({
  accountId,
  locale,
  copy,
  base,
  request,
  emptyText,
  refreshKey = 0,
}: MarketingViewProps & { request: MarketingRequest; emptyText: string; refreshKey?: number }) {
  const artifacts = useWorkspace<{ artifacts: MarketingArtifact[] }>(MKT_API.requestArtifacts(request.id), accountId)
  const d = copy.deliverables
  const { mutate } = artifacts

  useEffect(() => {
    if (refreshKey) mutate()
  }, [refreshKey, mutate])

  if (artifacts.isLoading) return <LoadingRows label={copy.kit.loading} rows={2} />
  if (artifacts.error) {
    return <WorkspaceState error={artifacts.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => mutate()} />
  }

  const rows = artifacts.data?.artifacts ?? []
  if (!rows.length) return <EmptyNote>{emptyText}</EmptyNote>

  const label = fill(d.tableLabel, { request: request.goal ?? request.id })
  return (
    <PlainTable label={label} headers={[d.type, d.review, d.generation, d.created]}>
      {rows.map((a) => (
        <tr key={a.id}>
          <td className={`${td} font-medium text-foreground`}>
            <Link href={`${base}/deliverables/${a.id}`} className="underline-offset-4 hover:underline">
              {enumLabel(copy.enums.artifactType, a.artifactType)}
            </Link>
          </td>
          <td className={td}>
            <StatusPill label={enumLabel(copy.enums.reviewStatus, a.reviewStatus)} tone={REVIEW_TONE[a.reviewStatus] ?? 'muted'} />
          </td>
          <td className={td}>{enumLabel(copy.enums.generation, a.generationMode)}</td>
          <td className={`${td} whitespace-nowrap`}>{formatDate(a.createdAt, locale)}</td>
        </tr>
      ))}
    </PlainTable>
  )
}
