'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import { GapNotice, PlainTable, SectionHeading, WorkspaceState } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, isGateError, withQuery } from '@/lib/crm-ui/workspace'
import { MKT_API, type MarketingArtifact, type MarketingRequest } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { REVIEW_TONE } from './shared'

/** The request list caps the per-request artifact fan-out. */
const FAN_OUT = 20

export function MarketingDeliverables(props: MarketingViewProps & { onlySubmitted?: boolean }) {
  const { accountId, copy, onlySubmitted } = props
  const list = useWorkspace<{ requests: MarketingRequest[] }>(withQuery(MKT_API.requests, { take: FAN_OUT }), accountId)
  const d = onlySubmitted ? copy.approvals : copy.deliverables
  const kit = copy.kit

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={d.title} description={d.description} />
      {onlySubmitted && <GapNotice title={copy.approvals.gapTitle} body={copy.approvals.gapBody} />}
      {list.isLoading ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : list.error ? (
        <WorkspaceState
          error={list.error}
          kit={kit}
          workspace={copy.name}
          compact={!isGateError(list.error)}
          onRetry={() => list.mutate()}
        />
      ) : !list.data?.requests.length ? (
        <EmptyNote>{onlySubmitted ? copy.approvals.empty : copy.deliverables.empty}</EmptyNote>
      ) : (
        list.data.requests.map((request) => (
          <Section key={request.id} title={request.goal ?? enumLabel(copy.enums.category, request.requestType)}>
            <ArtifactsTable
              {...props}
              request={request}
              onlySubmitted={onlySubmitted}
              emptyText={onlySubmitted ? copy.approvals.empty : copy.deliverables.noArtifacts}
            />
          </Section>
        ))
      )}
    </div>
  )
}

export function ArtifactsTable({
  accountId,
  locale,
  copy,
  base,
  request,
  onlySubmitted,
  emptyText,
  refreshKey = 0,
}: MarketingViewProps & { request: MarketingRequest; onlySubmitted?: boolean; emptyText: string; refreshKey?: number }) {
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

  const rows = (artifacts.data?.artifacts ?? []).filter((a) => !onlySubmitted || a.reviewStatus === 'SUBMITTED')
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
