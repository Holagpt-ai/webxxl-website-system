import { Prisma } from '@prisma/client'
import type { MarketingRequestStatus } from '@prisma/client'
import { isMktDraftPreparationEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { assertManagedSiteInAccount } from '@/lib/platform/marketing/account-isolation'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { computeMarketingRequestFingerprint } from '@/lib/platform/marketing/request-fingerprint'
import { validateMarketingRequestPayload } from '@/lib/platform/marketing/request-validation'
import { assertMarketingStatusTransition } from '@/lib/platform/marketing/transitions'
import {
  mapCategoryToRequestType,
  type MarketingRequestCategory,
  type MktResult,
} from '@/lib/platform/marketing/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

const DEFAULT_WORKFLOW = 'mkt-08-default'

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

  const validated = validateMarketingRequestPayload({
    category: input.category,
    goal: input.goal,
    brief: input.brief,
    locale: input.locale,
    audience: input.audience,
    sourceRefs: input.sourceRefs,
    idempotencyKey: input.idempotencyKey,
  })
  if (!validated.ok) return { ok: false, code: 'VALIDATION', message: validated.message }

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

  if (input.seoOpportunityId) {
    const opportunity = await prisma.seoOpportunity.findFirst({
      where: { id: input.seoOpportunityId, customerAccountId: input.customerAccountId },
    })
    if (!opportunity) {
      return { ok: false, code: 'NOT_FOUND', message: 'SEO opportunity not found for account' }
    }
    if (input.managedSiteId && opportunity.managedSiteId !== input.managedSiteId) {
      return { ok: false, code: 'FORBIDDEN', message: 'SEO opportunity does not belong to the selected site' }
    }
    if (!input.managedSiteId && opportunity.managedSiteId) {
      return { ok: false, code: 'VALIDATION', message: 'managedSiteId required when linking an SEO opportunity' }
    }
  }

  const sourceRefs = input.sourceRefs ?? []
  const fingerprint = computeMarketingRequestFingerprint({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    category: validated.category,
    goal: input.goal,
    brief: input.brief,
    locale: validated.locale,
    audience: input.audience,
    sourceRefs,
    seoOpportunityId: input.seoOpportunityId,
    crmSegmentId: null,
    assignedWorkflow: DEFAULT_WORKFLOW,
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

  try {
    const created = await prisma.marketingRequest.create({
      data: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        requestType: mapCategoryToRequestType(validated.category),
        status: 'SUBMITTED',
        brief: input.brief,
        locale: validated.locale,
        audience: input.audience,
        goal: input.goal,
        sourceRefs,
        artifactIds: [],
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        seoOpportunityId: input.seoOpportunityId ?? null,
        assignedWorkflow: DEFAULT_WORKFLOW,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.marketingRequest.findFirst({ where: { idempotencyKey: input.idempotencyKey } })
      if (!raced) return { ok: false, code: 'CONFLICT', message: 'Concurrent request creation conflict' }
      if (raced.customerAccountId !== input.customerAccountId) {
        return { ok: false, code: 'CONFLICT', message: 'Idempotency key already used for another account' }
      }
      if (raced.requestFingerprint !== fingerprint) {
        return { ok: false, code: 'CONFLICT', message: 'Idempotency key reused with different request payload' }
      }
      return { ok: true, value: { requestId: raced.id, status: raced.status } }
    }
    throw error
  }
}

export async function transitionMarketingRequestInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    customerAccountId: string
    requestId: string
    toStatus: MarketingRequestStatus
    actorUserId: string
    actorType: 'USER' | 'SERVICE' | 'AGENT'
    reason?: string
  },
): Promise<MktResult<true>> {
  const req = await tx.marketingRequest.findFirst({
    where: { id: input.requestId, customerAccountId: input.customerAccountId },
  })
  if (!req) return { ok: false, code: 'NOT_FOUND', message: 'Marketing request not found' }
  const transition = assertMarketingStatusTransition(req.status, input.toStatus)
  if (!transition.ok) return transition

  const updated = await tx.marketingRequest.updateMany({
    where: { id: req.id, customerAccountId: input.customerAccountId, status: req.status },
    data: { status: input.toStatus },
  })
  if (updated.count !== 1) {
    return { ok: false, code: 'CONFLICT', message: 'Request status changed concurrently' }
  }

  await tx.marketingRequestStatusEvent.create({
    data: {
      customerAccountId: input.customerAccountId,
      marketingRequestId: req.id,
      fromStatus: req.status,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      actorType: input.actorType,
      reason: input.reason,
    },
  })
  return { ok: true, value: true }
}

/** Throw from inside a Prisma transaction to roll back prepare workflow after partial writes. */
export class MarketingPrepareWorkflowRollbackError extends Error {
  constructor(
    public readonly code: 'VALIDATION' | 'CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'MarketingPrepareWorkflowRollbackError'
  }
}

export function mapTransitionFailureToPrepareRollback(result: MktResult<true>): MarketingPrepareWorkflowRollbackError {
  const code = result.ok ? 'VALIDATION' : result.code === 'CONFLICT' ? 'CONFLICT' : 'VALIDATION'
  return new MarketingPrepareWorkflowRollbackError(code, result.ok ? 'Invalid transition' : result.message)
}

export async function transitionMarketingRequest(input: {
  customerAccountId: string
  requestId: string
  toStatus: MarketingRequestStatus
  actorUserId: string
  actorType: 'USER' | 'SERVICE' | 'AGENT'
  reason?: string
}): Promise<MktResult<true>> {
  return prisma.$transaction(async (tx) => transitionMarketingRequestInTransaction(tx, input))
}
