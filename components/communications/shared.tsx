'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill, WorkspaceState, type PillTone } from '@/components/crm/workspace-kit'
import { fill, formatDateTime, isGateError, type WorkspaceError } from '@/lib/crm-ui/workspace'
import type { CommsWorkspaceCopy } from '@/lib/i18n/dictionaries/comms-workspace-en'

export const STATUS_TONE: Record<string, PillTone> = {
  OPEN: 'info',
  PENDING: 'neutral',
  RESOLVED: 'success',
  SNOOZED: 'muted',
}

export const VISIBILITY_TONE: Record<string, PillTone> = {
  VERIFIED: 'success',
  STALE_SYNC: 'neutral',
  MAPPING_PENDING: 'neutral',
  DISCONNECTED: 'danger',
  NOT_CONFIGURED: 'muted',
}

export const CONNECTION_TONE: Record<string, PillTone> = {
  READY: 'success',
  PARTIAL: 'neutral',
  MAPPING_PENDING: 'neutral',
  STALE_SYNC: 'neutral',
  DISCONNECTED: 'danger',
  NOT_CONNECTED: 'muted',
}

/**
 * Boolean wrapper around the shared type predicate, so a failed gate check does not narrow the
 * error to `never` for the not-found and validation branches that follow it.
 */
export function isCommsGate(error: WorkspaceError | undefined): boolean {
  return isGateError(error)
}

/** Gate states (disabled, policy unresolved, signed out) use communications-specific copy where it exists. */
export function CommsGate({ error, copy }: { error: WorkspaceError; copy: CommsWorkspaceCopy }) {
  const body = error.kind === 'DISABLED' ? copy.gates.disabled : error.kind === 'POLICY_UNRESOLVED' ? copy.gates.policy : undefined
  return <WorkspaceState error={error} kit={copy.kit} workspace={copy.name} body={body} />
}

/** A missing timestamp means the sync time is unknown, never that it was recent. */
export function SyncCell({
  lastSyncAt,
  syncStale,
  locale,
  copy,
}: {
  lastSyncAt: string | null
  syncStale: boolean
  locale: string
  copy: CommsWorkspaceCopy
}) {
  if (!lastSyncAt) {
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusPill label={copy.sync.unknown} tone="muted" />
        <span className="sr-only">{copy.sync.unknownHint}</span>
      </span>
    )
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="whitespace-nowrap">{formatDateTime(lastSyncAt, locale)}</span>
      {syncStale && <StatusPill label={copy.sync.stale} tone="danger" />}
    </span>
  )
}

export function CursorPager({
  page,
  hasPrevious,
  nextCursor,
  count,
  onFirst,
  onPrevious,
  onNext,
  copy,
}: {
  page: number
  hasPrevious: boolean
  nextCursor?: string
  count: number
  onFirst: () => void
  onPrevious: () => void
  onNext: (cursor: string) => void
  copy: CommsWorkspaceCopy
}) {
  if (!hasPrevious && !nextCursor) return null
  const p = copy.pager
  return (
    <nav aria-label={p.label} className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fill(p.page, { page })} · {fill(p.showing, { count })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={onFirst}>
          <ChevronsLeft className="size-4" aria-hidden="true" />
          {p.first}
        </Button>
        <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={onPrevious}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {p.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={!nextCursor} onClick={() => nextCursor && onNext(nextCursor)}>
          {p.next}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
