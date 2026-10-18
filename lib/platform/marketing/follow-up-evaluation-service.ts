import { isMktLeadMonitorEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { defaultFollowUpDueAt } from '@/lib/platform/crm/follow-up-service'
import {
  buildEvaluationEvidenceFingerprint,
  coverageFromEvidence,
  deriveFollowUpEvidenceFromTimeline,
} from '@/lib/platform/marketing/follow-up-coverage-evidence'
import { clampFollowUpEvalLimit } from '@/lib/platform/marketing/request-validation'
import type { CrmFollowUpCoverage } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

export type LeadEvaluationRow = {
  contactId: string
  coverageState: CrmFollowUpCoverage
  dueAt?: string
  evidenceRefs: string[]
  recommendedAction?: string
}

export async function evaluateAccountLeadFollowUps(input: {
  customerAccountId: string
  managedSiteId?: string
  idempotencyKey?: string
  limit?: number
}): Promise<MktResult<{ rows: LeadEvaluationRow[]; summary: Record<string, number> }>> {
  if (!isMktLeadMonitorEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Lead monitor disabled' }
  }

  const take = clampFollowUpEvalLimit(input.limit)
  const policy = await prisma.marketingLeadFollowUpPolicy.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      enabled: true,
      ...(input.managedSiteId ? { OR: [{ managedSiteId: input.managedSiteId }, { managedSiteId: null }] } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })
  const thresholdDays = policy?.ageThresholdDays ?? 4
  const policyVersion = policy?.policyVersion ?? 'mkt-08-v1'

  const messagingTenant = await prisma.messagingTenant.findUnique({
    where: { customerAccountId: input.customerAccountId },
  })

  const contacts = await prisma.crmContact.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      status: 'ACTIVE',
      ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    },
    take,
    orderBy: { createdAt: 'asc' },
  })

  const rows: LeadEvaluationRow[] = []
  const summary: Record<string, number> = {}
  const now = new Date()

  for (const contact of contacts) {
    const timeline = await prisma.crmTimelineEvent.findMany({
      where: { customerAccountId: input.customerAccountId, contactId: contact.id },
      orderBy: { eventAt: 'desc' },
      take: 50,
    })

    const tasks = await prisma.crmTask.findMany({
      where: { customerAccountId: input.customerAccountId, contactId: contact.id },
      take: 10,
    })

    const completedCallbackTask = tasks.some(
      (t) => t.status === 'COMPLETED' && /callback/i.test(t.title),
    )
    const pendingCallbackTask = tasks.some(
      (t) => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && /callback/i.test(t.title),
    )

    const suppression = await prisma.contactSuppression.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: contact.id,
        active: true,
      },
    })

    const consent = await prisma.contactConsent.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: contact.id,
        purpose: 'MARKETING',
        status: 'GRANTED',
      },
    })

    const chatwootMapping = await prisma.chatwootConversationMapping.findFirst({
      where: { customerAccountId: input.customerAccountId, crmContactId: contact.id },
    })

    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: timeline.map((e) => ({
        id: e.id,
        eventKind: e.eventKind,
        eventAt: e.eventAt,
        direction: e.direction,
        disposition: e.disposition,
        sourceSystem: e.sourceSystem,
      })),
      hasMessagingTenant: Boolean(messagingTenant),
      hasChatwootMapping: Boolean(chatwootMapping),
      activeSuppression: Boolean(suppression),
      marketingConsentStatus: consent ? 'GRANTED' : 'NONE',
      completedCallbackTask,
      pendingCallbackTask,
    })

    if (evidence.hasActiveSuppression) {
      summary.NOT_ELIGIBLE = (summary.NOT_ELIGIBLE ?? 0) + 1
      continue
    }

    const dueAt = defaultFollowUpDueAt(contact.createdAt, thresholdDays)
    let coverage = coverageFromEvidence({ evidence, dueAt, now })

    if (!evidence.marketingConsentGranted && coverage === 'OVERDUE') {
      coverage = 'UNKNOWN_COVERAGE'
      evidence.evidenceRefs.push('crm:consent:marketing_not_granted')
    }

    summary[coverage] = (summary[coverage] ?? 0) + 1

    const dedupeKey = `${input.customerAccountId}:${contact.id}:${policyVersion}`
    const evidenceFingerprint = buildEvaluationEvidenceFingerprint(evidence.evidenceRefs)

    const existing = await prisma.marketingLeadFollowUpEvaluation.findFirst({
      where: { customerAccountId: input.customerAccountId, dedupeKey },
    })

    const evalPayload = {
      managedSiteId: contact.managedSiteId,
      policyVersion,
      dueAt,
      coverageState: coverage,
      evidenceRefs: evidence.evidenceRefs,
      lastEvaluatedAt: now,
      recommendedAction: coverage === 'OVERDUE' ? 'CALLBACK' : undefined,
      idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${contact.id}` : undefined,
    }

    if (existing) {
      const stale =
        existing.coverageState !== coverage ||
        buildEvaluationEvidenceFingerprint((existing.evidenceRefs as string[] | null) ?? []) !== evidenceFingerprint
      if (!stale && existing.lastEvaluatedAt.getTime() > now.getTime() - 60_000) {
        // Recent identical evaluation — avoid write churn on rapid retries
      } else {
        await prisma.marketingLeadFollowUpEvaluation.update({
          where: { id: existing.id },
          data: evalPayload,
        })
      }
    } else {
      await prisma.marketingLeadFollowUpEvaluation.create({
        data: {
          customerAccountId: input.customerAccountId,
          crmContactId: contact.id,
          dedupeKey,
          ...evalPayload,
        },
      })
    }

    rows.push({
      contactId: contact.id,
      coverageState: coverage,
      dueAt: dueAt.toISOString(),
      evidenceRefs: evidence.evidenceRefs,
      recommendedAction: coverage === 'OVERDUE' ? 'Prepare human callback task' : undefined,
    })
  }

  return { ok: true, value: { rows, summary } }
}
