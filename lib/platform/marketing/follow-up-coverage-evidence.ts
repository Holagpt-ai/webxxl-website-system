import type { CrmFollowUpCoverage, CrmTimelineEventKind } from '@prisma/client'
import { classifyFollowUpCoverage } from '@/lib/platform/crm/follow-up-service'

const QUALIFYING_OUTREACH_KINDS: Set<CrmTimelineEventKind> = new Set([
  'SMS_DELIVERED',
  'EMAIL_SENT',
  'CALL_DISPOSITION',
])

const NON_OUTREACH_TASK_KINDS: Set<CrmTimelineEventKind> = new Set(['TASK_CREATED', 'TASK_COMPLETED'])

export type TimelineEvidenceRow = {
  eventKind: CrmTimelineEventKind
  eventAt: Date
  direction?: string | null
  disposition?: string | null
  sourceSystem: string
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

export function deriveFollowUpEvidenceFromTimeline(input: {
  timeline: TimelineEvidenceRow[]
  hasMessagingTenant: boolean
  hasChatwootMapping: boolean
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
    if (NON_OUTREACH_TASK_KINDS.has(event.eventKind)) continue
    if (event.eventKind === 'OUTBOUND_SMS_REQUESTED' || event.eventKind === 'SMS_ACCEPTED') continue

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

  const nativeTimelineEvidence = input.timeline.some((e) => e.sourceSystem.startsWith('native.') || e.sourceSystem.startsWith('crm.'))
  const providerCoverageMissing =
    !nativeTimelineEvidence &&
    !input.hasMessagingTenant &&
    !input.hasChatwootMapping &&
    !hasQualifyingOutreach

  if (input.pendingCallbackTask && !hasQualifyingOutreach) {
    evidenceRefs.push('crm:task:pending_callback_not_outreach')
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
