import { isMktLeadMonitorEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { classifyFollowUpCoverage, defaultFollowUpDueAt } from '@/lib/platform/crm/follow-up-service'
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
  idempotencyKey?: string
  limit?: number
}): Promise<MktResult<{ rows: LeadEvaluationRow[]; summary: Record<string, number> }>> {
  if (!isMktLeadMonitorEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Lead monitor disabled' }
  }
  const policy = await prisma.marketingLeadFollowUpPolicy.findFirst({
    where: { customerAccountId: input.customerAccountId, enabled: true },
  })
  const thresholdDays = policy?.ageThresholdDays ?? 4

  const contacts = await prisma.crmContact.findMany({
    where: { customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    take: input.limit ?? 50,
    orderBy: { createdAt: 'asc' },
  })

  const rows: LeadEvaluationRow[] = []
  const summary: Record<string, number> = {}

  for (const contact of contacts) {
    const tasks = await prisma.crmTask.findMany({
      where: { customerAccountId: input.customerAccountId, contactId: contact.id },
      take: 5,
    })
    const completedCallback = tasks.some((t) => t.status === 'COMPLETED' && /callback/i.test(t.title))
    const pendingTask = tasks.some((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    const suppression = await prisma.contactSuppression.findFirst({
      where: { customerAccountId: input.customerAccountId, contactId: contact.id },
    })
    const consent = await prisma.contactConsent.findFirst({
      where: { customerAccountId: input.customerAccountId, contactId: contact.id, purpose: 'MARKETING' },
    })

    const providerCoverageMissing = true
    const hasOutreach = tasks.length > 0
    const dueAt = defaultFollowUpDueAt(contact.createdAt, thresholdDays)
    let coverage = classifyFollowUpCoverage({
      hasQualifyingOutreach: hasOutreach,
      providerCoverageMissing,
      awaitingReply: pendingTask,
      dueAt,
      completed: completedCallback,
    })

    if (suppression) {
      summary.NOT_ELIGIBLE = (summary.NOT_ELIGIBLE ?? 0) + 1
      continue
    }
    if (!consent && coverage === 'OVERDUE') coverage = 'UNKNOWN_COVERAGE'

    summary[coverage] = (summary[coverage] ?? 0) + 1
    const dedupeKey = `${input.customerAccountId}:${contact.id}:${policy?.policyVersion ?? 'default'}`
    const existing = await prisma.marketingLeadFollowUpEvaluation.findFirst({
      where: { customerAccountId: input.customerAccountId, dedupeKey },
    })
    if (!existing) {
      await prisma.marketingLeadFollowUpEvaluation.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: contact.managedSiteId,
          crmContactId: contact.id,
          policyVersion: policy?.policyVersion ?? 'mkt-08-v1',
          dueAt,
          coverageState: coverage,
          evidenceRefs: [`crm:contact:${contact.id}`, `crm:tasks:${tasks.length}`],
          recommendedAction: coverage === 'OVERDUE' ? 'CALLBACK' : undefined,
          dedupeKey,
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${contact.id}` : undefined,
        },
      })
    }

    rows.push({
      contactId: contact.id,
      coverageState: coverage,
      dueAt: dueAt.toISOString(),
      evidenceRefs: [`crm:contact:${contact.id}`],
      recommendedAction: coverage === 'OVERDUE' ? 'Prepare human callback task' : undefined,
    })
  }

  return { ok: true, value: { rows, summary } }
}
