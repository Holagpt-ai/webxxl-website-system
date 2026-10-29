'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyNote, LoadingRows, StatusPill } from '@/components/commerce/ui'
import { Facts, GapNotice, SectionHeading, SelectField, SuccessNote, WorkspaceState } from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, isGateError, withQuery, workspaceSend, type WorkspaceError } from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  MKT_PAGE_SIZE,
  REVIEW_INBOX_STATUSES,
  type MarketingReview,
  type MarketingReviewListResponse,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { useCursorPages } from '@/lib/marketing-studio-ui/use-cursor-pages'
import { CursorPager, isStaleCursor } from './deliverables'
import { REVIEW_TONE, siteLabel } from './shared'

type Decision = 'APPROVED' | 'REJECTED'
type PendingDecision = { review: MarketingReview; decision: Decision }

export function MarketingApprovals(props: MarketingViewProps) {
  const { accountId, copy, sites } = props
  const a = copy.approvals
  const kit = copy.kit
  const [status, setStatus] = useState<string>('SUBMITTED')
  const [managedSiteId, setManagedSiteId] = useState('')
  const paging = useCursorPages(`${status}|${managedSiteId}`)
  const [staleReset, setStaleReset] = useState(false)
  const [confirm, setConfirm] = useState<PendingDecision | null>(null)
  const [outcome, setOutcome] = useState<{ kind: 'ok'; decision: Decision } | { kind: 'error'; error: WorkspaceError } | null>(
    null,
  )
  const action = useAction<unknown>()

  const url = withQuery(MKT_API.reviews, {
    take: MKT_PAGE_SIZE,
    cursor: paging.cursor,
    status,
    managedSiteId: managedSiteId || undefined,
  })
  const list = useWorkspace<MarketingReviewListResponse>(url, accountId)
  const { first } = paging

  useEffect(() => {
    if (paging.cursor && isStaleCursor(list.error)) {
      setStaleReset(true)
      first()
    }
  }, [list.error, paging.cursor, first])

  const rows = list.data?.reviews ?? []
  const anyDecidable = rows.some((r) => r.allowedActions.canDecide)

  const decide = async () => {
    if (!confirm) return
    const { review, decision } = confirm
    setOutcome(null)
    const result = await action.run(() => workspaceSend(MKT_API.decide(review.id), { decision }))
    setConfirm(null)
    setOutcome(result.ok ? { kind: 'ok', decision } : { kind: 'error', error: result.error })
    // Always re-read: on success the row leaves the pending bucket; on 409 the server state moved on.
    await list.mutate()
  }

  const changeFilter = (apply: () => void) => {
    setStaleReset(false)
    setOutcome(null)
    apply()
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={a.title} description={a.description} />

      <div role="group" aria-label={a.filtersLabel} className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={a.filterStatus}
          value={status}
          onChange={(v) => changeFilter(() => setStatus(v))}
          options={REVIEW_INBOX_STATUSES.map((v) => ({ value: v, label: enumLabel(copy.enums.reviewStatus, v) }))}
        />
        {sites.length > 0 && (
          <SelectField
            label={a.filterSite}
            value={managedSiteId}
            onChange={(v) => changeFilter(() => setManagedSiteId(v))}
            options={[{ value: '', label: a.allSites }, ...sites.map((s) => ({ value: s.id, label: s.domain ?? s.name }))]}
          />
        )}
      </div>

      {staleReset && <GapNotice title={copy.paging.staleTitle} body={copy.paging.staleBody} />}
      <div aria-live="polite">
        {outcome?.kind === 'ok' && (
          <SuccessNote>{outcome.decision === 'APPROVED' ? a.decidedApproved : a.decidedRejected}</SuccessNote>
        )}
        {outcome?.kind === 'error' && <DecisionError error={outcome.error} copy={copy} />}
      </div>

      {list.isLoading ? (
        <LoadingRows label={kit.loading} rows={3} />
      ) : list.error && !(paging.cursor && isStaleCursor(list.error)) ? (
        <WorkspaceState
          error={list.error}
          kit={kit}
          workspace={copy.name}
          compact={!isGateError(list.error)}
          onRetry={() => list.mutate()}
        />
      ) : !rows.length ? (
        <EmptyNote>{status === 'SUBMITTED' ? a.emptyPending : a.emptyOther}</EmptyNote>
      ) : (
        <>
          {status === 'SUBMITTED' && !anyDecidable && <GapNotice title={a.readOnlyTitle} body={a.readOnlyBody} />}
          <ul aria-label={a.listLabel} className="flex flex-col gap-4">
            {rows.map((review) => (
              <ReviewCard
                key={review.id}
                {...props}
                review={review}
                busy={action.pending}
                siteText={siteLabel(sites, review.managedSiteId, a.noSite)}
                onDecide={(decision) => {
                  setOutcome(null)
                  setConfirm({ review, decision })
                }}
              />
            ))}
          </ul>
          <CursorPager
            copy={copy}
            paging={paging}
            nextCursor={list.data?.nextCursor}
            onMove={() => {
              setStaleReset(false)
              setOutcome(null)
            }}
          />
        </>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open: boolean) => {
          if (!open && !action.pending) setConfirm(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.decision === 'REJECTED' ? a.confirmRejectTitle : a.confirmApproveTitle}</DialogTitle>
            <DialogDescription>
              {confirm
                ? fill(a.confirmBody, {
                    hash: shortHash(confirm.review.revisionHash),
                    action: enumLabel({}, confirm.review.allowedActions.intendedAction),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={action.pending} onClick={() => setConfirm(null)}>
              {a.cancel}
            </Button>
            <Button
              variant={confirm?.decision === 'REJECTED' ? 'destructive' : 'default'}
              disabled={action.pending}
              onClick={() => void decide()}
            >
              {action.pending ? a.deciding : confirm?.decision === 'REJECTED' ? a.confirmReject : a.confirmApprove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReviewCard({
  review,
  copy,
  locale,
  base,
  busy,
  siteText,
  onDecide,
}: MarketingViewProps & { review: MarketingReview; busy: boolean; siteText: string; onDecide: (d: Decision) => void }) {
  const a = copy.approvals
  const { allowedActions } = review
  const effective = review.effectiveStatus
  const stored = review.status

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{a.intendedAction}</p>
          <h3 className="text-base font-medium text-foreground text-pretty">
            {enumLabel({}, allowedActions.intendedAction)}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill label={enumLabel(copy.enums.reviewStatus, effective)} tone={REVIEW_TONE[effective] ?? 'muted'} />
          {stored !== effective && (
            <span className="text-xs text-muted-foreground">
              {fill(a.storedAs, { status: enumLabel(copy.enums.reviewStatus, stored) })}
            </span>
          )}
        </div>
      </div>

      <Facts
        items={[
          [a.revision, <code key="h" className="font-mono text-xs">{shortHash(review.revisionHash)}</code>],
          [a.channel, allowedActions.allowedChannel ? enumLabel(copy.enums.platform, allowedActions.allowedChannel) : a.any],
          [a.target, allowedActions.allowedTarget ?? a.any],
          [a.site, siteText],
          [a.submitted, formatDate(review.createdAt, locale)],
          [a.expires, review.expiresAt ? formatDate(review.expiresAt, locale) : a.noExpiry],
          ...(review.decidedAt ? ([[a.decided, formatDate(review.decidedAt, locale)]] as [string, React.ReactNode][]) : []),
          ...(review.revokedAt ? ([[a.revoked, formatDate(review.revokedAt, locale)]] as [string, React.ReactNode][]) : []),
          [a.policy, review.policyVersion],
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={`${base}/deliverables/${review.marketingArtifactId}`} className="text-primary underline-offset-4 hover:underline">
            {a.openArtifact}
          </Link>
          <Link href={`${base}/requests/${review.marketingRequestId}`} className="text-primary underline-offset-4 hover:underline">
            {a.openRequest}
          </Link>
        </div>
        {allowedActions.canDecide ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide('REJECTED')}>
              {a.reject}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onDecide('APPROVED')}>
              {a.approve}
            </Button>
          </div>
        ) : (
          effective === 'SUBMITTED' && <span className="text-xs text-muted-foreground">{a.rowReadOnly}</span>
        )}
      </div>
    </li>
  )
}

function DecisionError({ error, copy }: { error: WorkspaceError; copy: MarketingViewProps['copy'] }) {
  const a = copy.approvals
  if (error.status === 409) return <GapNotice title={a.conflictTitle} body={a.conflictBody} />
  const body =
    error.kind === 'DISABLED' || error.kind === 'NOT_CONFIGURED'
      ? a.disabledBody
      : error.kind === 'FORBIDDEN'
        ? a.forbiddenBody
        : a.failedBody
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {body}
    </p>
  )
}

function shortHash(hash: string): string {
  return hash.length > 12 ? hash.slice(0, 12) : hash
}
