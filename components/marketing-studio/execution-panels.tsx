'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { EmptyNote, StatusPill, td, type PillTone } from '@/components/commerce/ui'
import { Facts, PlainTable, StatTile } from '@/components/crm/workspace-kit'
import { DASH, enumLabel, fill, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import {
  EXECUTION_LADDER_STEPS,
  type CrmAudiencePlanningData,
  type ExecutionSlice,
  type ReviewEvidenceRow,
  type SocialHandoffPolicyData,
  type SocialProviderReadinessData,
  type WorkflowLifecycleCounts,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingStudioCopy } from '@/lib/i18n/dictionaries/marketing-studio-en'

type PanelCopy = { copy: MarketingStudioCopy; locale: string }

export function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-background p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function SliceUnavailable({
  slice,
  copy,
}: {
  slice: Extract<ExecutionSlice<unknown>, { status: 'UNAVAILABLE' }>
  copy: MarketingStudioCopy
}) {
  const e = copy.execution
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border bg-muted px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={e.unavailable} tone="muted" />
        <span className="font-medium text-foreground">{e.reasons[slice.reasonCode] ?? e.reasonFallback}</span>
      </div>
      {slice.message && <p className="leading-relaxed text-muted-foreground">{slice.message}</p>}
      <p className="text-xs text-muted-foreground">
        {e.reasonCode}: <span className="font-mono">{slice.reasonCode}</span>
      </p>
    </div>
  )
}

function SourceNotice({ label, text }: { label: string; text: string }) {
  return (
    <p className="rounded-lg border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {text}
    </p>
  )
}

/* ---------- Workflow counts ---------- */

export function WorkflowPanel({ slice, copy, locale }: PanelCopy & { slice: ExecutionSlice<WorkflowLifecycleCounts> }) {
  const e = copy.execution
  return (
    <Panel title={e.ladderTitle} description={e.ladderBody}>
      {slice.status === 'UNAVAILABLE' ? (
        <SliceUnavailable slice={slice} copy={copy} />
      ) : (
        <>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" aria-label={e.ladderTitle}>
            {EXECUTION_LADDER_STEPS.map((step) => (
              <li key={step} className="contents">
                <StatTile
                  label={e.ladder[step] ?? step}
                  value={formatNumber(slice.data.executionLadder[step] ?? 0, locale)}
                  hint={e.ladderHints[step]}
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground">{e.breakdownTitle}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Breakdown title={e.requestStatus} counts={slice.data.requestStatus} labels={copy.enums.requestStatus} copy={copy} locale={locale} />
              <Breakdown title={e.reviewStatus} counts={slice.data.reviewEffectiveStatus} labels={copy.enums.reviewStatus} copy={copy} locale={locale} />
              <Breakdown
                title={e.publicationStatus}
                counts={slice.data.publicationStatus}
                labels={copy.enums.publicationStatus}
                copy={copy}
                locale={locale}
              />
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}

function Breakdown({
  title,
  counts,
  labels,
  copy,
  locale,
}: PanelCopy & { title: string; counts: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.execution.noCounts}</p>
      ) : (
        <dl className="flex flex-col gap-1.5 text-sm">
          {entries.map(([status, n]) => (
            <div key={status} className="flex items-center justify-between gap-3">
              <dt className="text-foreground">{enumLabel(labels, status)}</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatNumber(n, locale)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/* ---------- Review evidence ---------- */

export function reviewTone(status: string): PillTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED' || status === 'REVOKED') return 'danger'
  if (status === 'SUBMITTED') return 'info'
  if (status === 'EXPIRED') return 'muted'
  return 'neutral'
}

export function ReviewEvidencePanel({
  slice,
  copy,
  locale,
  base,
}: PanelCopy & { slice: ExecutionSlice<{ items: ReviewEvidenceRow[]; truncated: boolean }>; base: string }) {
  const e = copy.execution
  return (
    <Panel title={e.reviewTitle} description={e.reviewBody}>
      {slice.status === 'UNAVAILABLE' ? (
        <SliceUnavailable slice={slice} copy={copy} />
      ) : slice.data.items.length === 0 ? (
        <EmptyNote>{e.noReviews}</EmptyNote>
      ) : (
        <div className="flex flex-col gap-3">
          <PlainTable
            label={e.reviewTitle}
            headers={[e.reviewStatusCol, e.channelCol, e.decidedCol, e.expiresCol, e.revisionCol, e.linksCol]}
          >
            {slice.data.items.map((row) => (
              <tr key={row.reviewId}>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.reviewStatus, row.effectiveStatus)} tone={reviewTone(row.effectiveStatus)} />
                </td>
                <td className={td}>{row.allowedChannel ? enumLabel(copy.enums.platform, row.allowedChannel) : e.anyChannel}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.revokedAt ?? row.decidedAt, locale)}</td>
                <td className={`${td} whitespace-nowrap`}>{row.expiresAt ? formatDateTime(row.expiresAt, locale) : DASH}</td>
                <td className={`${td} font-mono text-xs`} title={row.revisionHash}>
                  {row.revisionHash.slice(0, 10)}
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <Link className="text-primary underline-offset-4 hover:underline" href={`${base}/deliverables/${encodeURIComponent(row.marketingArtifactId)}`}>
                      {e.openDeliverable}
                    </Link>
                    <Link className="text-primary underline-offset-4 hover:underline" href={`${base}/requests/${encodeURIComponent(row.marketingRequestId)}`}>
                      {e.openRequest}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </PlainTable>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {slice.data.truncated ? <p className="text-xs text-muted-foreground">{e.reviewTruncated}</p> : <span />}
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/approvals`}>
              {e.viewApprovals}
            </Link>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ---------- CRM audience planning ---------- */

export function AudiencePlanningPanel({
  slice,
  planningDisclosure,
  copy,
  locale,
}: PanelCopy & { slice: ExecutionSlice<CrmAudiencePlanningData>; planningDisclosure: string }) {
  const e = copy.execution
  return (
    <Panel title={e.crmTitle} description={e.crmBody}>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={e.planningOnly} tone="info" />
        <StatusPill label={e.notSend} tone="muted" />
      </div>
      <SourceNotice label={e.sourceNotice} text={planningDisclosure} />
      {slice.status === 'UNAVAILABLE' ? (
        <SliceUnavailable slice={slice} copy={copy} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={e.segmentCatalog} value={formatNumber(slice.data.segmentCatalogCount, locale)} />
            <StatTile label={e.eligibleSegments} value={formatNumber(slice.data.eligibleSegmentCount, locale)} />
          </div>
          {slice.data.latestPreview ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{e.latestPreview}</p>
                <p className="font-medium text-foreground">{slice.data.latestPreview.segmentName}</p>
                <p className="text-xs text-muted-foreground">
                  {fill(e.evaluatedAt, { date: formatDateTime(slice.data.latestPreview.evaluatedAt, locale) })}
                </p>
              </div>
              <dl className="flex flex-col gap-1.5 text-sm">
                {Object.entries(slice.data.latestPreview.audience).map(([key, n]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <dt className="text-foreground">{e.buckets[key] ?? key}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatNumber(n, locale)}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">{e.bucketsNote}</p>
            </div>
          ) : (
            <EmptyNote>{e.noPreview}</EmptyNote>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{e.snapshotCaveat}</p>
        </>
      )}
    </Panel>
  )
}

/* ---------- Postiz readiness + handoff policy ---------- */

function connectionTone(state: string): PillTone {
  if (state === 'CONNECTED') return 'success'
  if (state === 'DEGRADED' || state === 'EXPIRED' || state === 'REVOKED') return 'danger'
  if (state === 'PENDING_AUTHORIZATION') return 'info'
  return 'muted'
}

export function SocialReadinessPanel({
  readiness,
  policy,
  copy,
  locale,
}: PanelCopy & { readiness: ExecutionSlice<SocialProviderReadinessData>; policy: ExecutionSlice<SocialHandoffPolicyData> }) {
  const e = copy.execution
  const onOff = (v: boolean) => (v ? e.on : e.off)
  return (
    <Panel title={e.socialTitle} description={e.socialBody}>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={e.preparationOnly} tone="info" />
        <StatusPill label={e.dispatchBlocked} tone="muted" />
        {readiness.status === 'AVAILABLE' && !readiness.data.workspaceConnected && (
          <StatusPill label={e.notConnected} tone="muted" />
        )}
      </div>

      {readiness.status === 'UNAVAILABLE' ? (
        <SliceUnavailable slice={readiness} copy={copy} />
      ) : (
        <>
          <Facts
            items={[
              [e.moduleEnabled, onOff(readiness.data.moduleEnabled)],
              [e.workspace, readiness.data.workspaceConnected ? e.connected : e.notConnected],
              [e.credentials, readiness.data.credentialsConfigured ? e.configured : e.notConfigured],
              [e.postizApi, onOff(readiness.data.postizApiEnabled)],
              [e.livePublishing, onOff(readiness.data.livePublishingEnabled)],
              [e.assessedAt, formatDateTime(readiness.data.assessedAt, locale)],
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{e.flagNote}</p>
          <div className="flex flex-col gap-1 rounded-lg border bg-muted px-4 py-3 text-sm">
            <span className="font-mono text-xs text-foreground">{readiness.data.dispatchBlockedCode}</span>
            <span className="leading-relaxed text-muted-foreground">{readiness.data.dispatchBlockedMessage}</span>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground">{e.channelsTitle}</h4>
            {readiness.data.channels.length === 0 ? (
              <EmptyNote>{e.noChannels}</EmptyNote>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {readiness.data.channels.map((ch) => (
                  <li key={ch.connectionId} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">{ch.displayName}</span>
                      <span className="text-xs text-muted-foreground">{enumLabel(copy.enums.platform, ch.platform)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill
                        label={enumLabel(copy.enums.connectionState, ch.connectionState)}
                        tone={connectionTone(ch.connectionState)}
                      />
                      {!ch.dispatchAllowed && <StatusPill label={e.dispatchBlocked} tone="muted" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {policy.status === 'UNAVAILABLE' ? (
        <SliceUnavailable slice={policy} copy={copy} />
      ) : (
        <Facts
          items={[
            [e.handoffMode, e.preparationOnly],
            [e.dispatchBlocked, policy.data.dispatchBlocked ? e.on : e.off],
          ]}
        />
      )}
    </Panel>
  )
}
