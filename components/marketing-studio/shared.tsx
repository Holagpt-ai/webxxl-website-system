import type { PillTone } from '@/components/commerce/ui'
import type { WorkspaceError } from '@/lib/crm-ui/workspace'
import type { ManagedSiteOption } from '@/lib/crm-ui/workspace'

export const REQUEST_TONE: Record<string, PillTone> = {
  DRAFT: 'muted',
  SUBMITTED: 'info',
  VALIDATING: 'info',
  PREPARING: 'info',
  DRAFT_READY: 'info',
  AWAITING_REVIEW: 'info',
  IN_REVIEW: 'info',
  REVISION_REQUESTED: 'neutral',
  APPROVED: 'success',
  REJECTED: 'danger',
  HANDED_OFF: 'success',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted',
}

export const REVIEW_TONE: Record<string, PillTone> = {
  DRAFT: 'muted',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'muted',
  REVOKED: 'muted',
}

export const CAMPAIGN_TONE: Record<string, PillTone> = {
  DRAFT: 'muted',
  AWAITING_APPROVAL: 'info',
  APPROVED: 'success',
  SCHEDULING: 'info',
  SCHEDULED: 'info',
  PUBLISHING: 'info',
  PUBLISHED: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted',
}

export const PUBLICATION_TONE: Record<string, PillTone> = {
  PENDING: 'muted',
  SCHEDULED: 'info',
  SCHEDULING_UNKNOWN: 'neutral',
  PUBLISHING: 'info',
  PUBLISHED: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted',
  RECONCILIATION_REQUIRED: 'danger',
}

export const CONNECTION_TONE: Record<string, PillTone> = {
  CONNECTED: 'success',
  PENDING_AUTHORIZATION: 'info',
  DEGRADED: 'neutral',
  EXPIRED: 'danger',
  REVOKED: 'muted',
  NOT_CONNECTED: 'muted',
  UNAVAILABLE: 'muted',
}

/** A disabled or unconfigured flag gets the feature-specific explanation instead of the generic one. */
export function flagBody(error: WorkspaceError | null | undefined, text: string): string | undefined {
  return error && (error.kind === 'DISABLED' || error.kind === 'NOT_CONFIGURED') ? text : undefined
}

export function siteLabel(sites: ManagedSiteOption[], id: string | null | undefined, fallback: string): string {
  if (!id) return fallback
  const site = sites.find((s) => s.id === id)
  return site ? (site.domain ?? site.name) : fallback
}
