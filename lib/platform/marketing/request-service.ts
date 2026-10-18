import { isMktDraftPreparationEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { assertManagedSiteInAccount } from '@/lib/platform/marketing/account-isolation'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { assertMarketingStatusTransition } from '@/lib/platform/marketing/transitions'
import {
  mapCategoryToRequestType,
  type MarketingRequestCategory,
  type MktResult,
} from '@/lib/platform/marketing/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

function buildRequestFingerprint(input: {
  category: MarketingRequestCategory
  goal: string
  locale: string
  managedSiteId?: string
}): string {
  return `${input.category}:${input.locale}:${input.managedSiteId ?? '-'}:${input.goal.trim()}`
}

export async function createMarketingRequestRecord(input: {
  customerAccountId: string
  userId: string
  managedSiteId?: string
  category: MarketingRequestCategory
  goal: string
  brief: string
  locale: 'en' | 'es'
  audience?: string
  sourceRefs?: string[]
  idempotencyKey: string
  seoOpportunityId?: string
}): Promise<MktResult<{ requestId: string; status: string }>> {
  if (!isMktDraftPreparationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing draft preparation disabled' }
  }
  const safe = assertMarketingContentAllowed({ text: `${input.brief} ${input.goal}` })
  if (!safe.ok) return safe

  if (input.managedSiteId) {
    const site = await assertManagedSiteInAccount({
      siteId: input.managedSiteId,
      customerAccountId: input.customerAccountId,
      loadSite: (id, acct) => getManagedSiteForAccount(id, acct),
    })
    if (!site.ok) return site
  }

  const fingerprint = buildRequestFingerprint({
    category: input.category,
    goal: input.goal,
    locale: input.locale,
    managedSiteId: input.managedSiteId,
  })

  const existingGlobal = await prisma.marketingRequest.findFirst({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existingGlobal) {
    if (existingGlobal.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key already used for another account' }
    }
    if (existingGlobal.requestFingerprint !== fingerprint) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key reused with different request payload' }
    }
    return { ok: true, value: { requestId: existingGlobal.id, status: existingGlobal.status } }
  }

  const created = await prisma.marketingRequest.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      requestType: mapCategoryToRequestType(input.category),
      status: 'SUBMITTED',
      brief: input.brief,
      locale: input.locale,
      audience: input.audience,
      goal: input.goal,
      sourceRefs: input.sourceRefs ?? [],
      artifactIds: [],
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      seoOpportunityId: input.seoOpportunityId ?? null,
      assignedWorkflow: 'mkt-08-default',
      createdByUserId: input.userId,
      statusEvents: {
        create: {
          customerAccountId: input.customerAccountId,
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          actorUserId: input.userId,
          actorType: 'USER',
          reason: 'Request submitted',
        },
      },
    },
  })

  return { ok: true, value: { requestId: created.id, status: created.status } }
}

export async function transitionMarketingRequest(input: {
  customerAccountId: string
  requestId: string
  toStatus: import('@prisma/client').MarketingRequestStatus
  actorUserId: string
  actorType: 'USER' | 'SERVICE' | 'AGENT'
  reason?: string
}): Promise<MktResult<true>> {
  const req = await prisma.marketingRequest.findFirst({
    where: { id: input.requestId, customerAccountId: input.customerAccountId },
  })
  if (!req) return { ok: false, code: 'NOT_FOUND', message: 'Marketing request not found' }
  const transition = assertMarketingStatusTransition(req.status, input.toStatus)
  if (!transition.ok) return transition
  await prisma.$transaction([
    prisma.marketingRequest.update({
      where: { id: req.id },
      data: { status: input.toStatus },
    }),
    prisma.marketingRequestStatusEvent.create({
      data: {
        customerAccountId: input.customerAccountId,
        marketingRequestId: req.id,
        fromStatus: req.status,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        reason: input.reason,
      },
    }),
  ])
  return { ok: true, value: true }
}
