import type { CrmFollowUpCoverage, CrmTimelineEventKind } from '@prisma/client'
import { classifyFollowUpCoverage } from '@/lib/platform/crm/follow-up-service'

const QUALIFYING_OUTREACH_KINDS: Set<CrmTimelineEventKind> = new Set([
  'SMS_DELIVERED',
  'EMAIL_SENT',
  'CALL_DISPOSITION',
])

const NON_OUTREACH_KINDS: Set<CrmTimelineEventKind> = new Set([
  'FORM_SUBMISSION',
  'TASK_CREATED',
  'TASK_COMPLETED',
  'OUTBOUND_SMS_REQUESTED',
  'SMS_ACCEPTED',
  'WEB_CHAT_STARTED',
  'NOTE',
])

export type TimelineEvidenceRow = {
  eventKind: CrmTimelineEventKind
  eventAt: Date
  direction?: string | null
  disposition?: string | null
  sourceSystem: string
  provenanceRef?: string | null
  id: string
}

export type FollowUpEvidenceSnapshot = {
  evidenceRefs: string[]
  hasQualifyingOutreach: boolean
  completedCallback: boolean
  awaitingReply: boolean
  providerCoverageMissing: boolean
  hasActiveSuppression: boolean
  marketingConsentGranted: boolean
}

/** Verified provider sync for an interval — not tenant/mapping existence alone. */
export function hasVerifiedProviderSyncCoverage(timeline: TimelineEvidenceRow[]): boolean {
  return timeline.some(
    (e) =>
      e.sourceSystem === 'comms.provider.sync_verified' ||
      (e.provenanceRef?.startsWith('verified_sync:') ?? false),
  )
}

export function deriveFollowUpEvidenceFromTimeline(input: {
  timeline: TimelineEvidenceRow[]
  hasVerifiedProviderSyncCoverage: boolean
  activeSuppression: boolean
  marketingConsentStatus: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE'
  completedCallbackTask: boolean
  pendingCallbackTask: boolean
}): FollowUpEvidenceSnapshot {
  const evidenceRefs: string[] = []
  let hasQualifyingOutreach = false
  let completedCallback = input.completedCallbackTask
  let lastOutboundAt: Date | undefined

  for (const event of input.timeline) {
    evidenceRefs.push(`crm:timeline:${event.id}:${event.eventKind}`)
    if (NON_OUTREACH_KINDS.has(event.eventKind)) continue

    if (event.eventKind === 'CALL_DISPOSITION') {
      if (/completed|success|reached|spoke/i.test(event.disposition ?? '')) {
        completedCallback = true
        hasQualifyingOutreach = true
        lastOutboundAt = event.eventAt
      }
      continue
    }

    if (QUALIFYING_OUTREACH_KINDS.has(event.eventKind)) {
      hasQualifyingOutreach = true
      lastOutboundAt = event.eventAt
    }
  }

  const inboundAfterOutbound =
    lastOutboundAt &&
    input.timeline.some(
      (e) => e.eventKind === 'HUMAN_REPLY' && e.eventAt.getTime() > lastOutboundAt!.getTime(),
    )

  const awaitingReply = hasQualifyingOutreach && !completedCallback && !inboundAfterOutbound && Boolean(lastOutboundAt)

  const providerCoverageMissing = !input.hasVerifiedProviderSyncCoverage && !hasQualifyingOutreach

  if (input.pendingCallbackTask && !hasQualifyingOutreach) {
    evidenceRefs.push('crm:task:pending_callback_not_outreach')
  }
  if (providerCoverageMissing) {
    evidenceRefs.push('coverage:provider_sync_not_verified')
  }

  return {
    evidenceRefs,
    hasQualifyingOutreach,
    completedCallback,
    awaitingReply: Boolean(awaitingReply),
    providerCoverageMissing,
    hasActiveSuppression: input.activeSuppression,
    marketingConsentGranted: input.marketingConsentStatus === 'GRANTED',
  }
}

export function coverageFromEvidence(input: {
  evidence: FollowUpEvidenceSnapshot
  dueAt: Date
  now?: Date
}): CrmFollowUpCoverage {
  return classifyFollowUpCoverage({
    hasQualifyingOutreach: input.evidence.hasQualifyingOutreach,
    providerCoverageMissing: input.evidence.providerCoverageMissing,
    awaitingReply: input.evidence.awaitingReply,
    dueAt: input.dueAt,
    completed: input.evidence.completedCallback,
    now: input.now,
  })
}

export function buildEvaluationEvidenceFingerprint(evidenceRefs: string[]): string {
  return [...evidenceRefs].sort().join('|')
}
