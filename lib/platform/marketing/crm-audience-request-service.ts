import { Prisma } from '@prisma/client'
import { isMktCrmAudiencePlanningEnabled, isMktDraftPreparationEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { assertManagedSiteInAccount } from '@/lib/platform/marketing/account-isolation'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { idempotentCampaignPreparationResponse } from '@/lib/platform/marketing/crm-audience-idempotency'
import {
  previewCrmSegmentAudience,
  type CrmSegmentAudiencePreview,
} from '@/lib/platform/marketing/crm-segment-audience-service'

export { parseStoredAudiencePlanningPreview } from '@/lib/platform/marketing/crm-audience-idempotency'
import { buildCrmSegmentSourceRef } from '@/lib/platform/marketing/crm-segment-source-ref'
import { computeMarketingRequestFingerprint } from '@/lib/platform/marketing/request-fingerprint'
import { validateMarketingRequestPayload } from '@/lib/platform/marketing/request-validation'
import type { MktResult } from '@/lib/platform/marketing/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

const DEFAULT_WORKFLOW = 'mkt-08-default'

export async function createCampaignPreparationFromCrmSegment(input: {
  customerAccountId: string
  userId: string
  crmSegmentId: string
  goal: string
  brief: string
  locale: 'en' | 'es'
  idempotencyKey: string
  managedSiteId?: string
  audienceLabel?: string
}): Promise<
  MktResult<{
    requestId: string
    status: string
    crmSegmentId: string
    audiencePreview: CrmSegmentAudiencePreview
  }>
> {
  if (!isMktDraftPreparationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing draft preparation disabled' }
  }
  if (!isMktCrmAudiencePlanningEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'CRM audience planning disabled' }
  }

  const validated = validateMarketingRequestPayload({
    category: 'CAMPAIGN_PREPARATION',
    goal: input.goal,
    brief: input.brief,
    locale: input.locale,
    audience: input.audienceLabel,
    sourceRefs: [buildCrmSegmentSourceRef(input.crmSegmentId)],
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

  const sourceRefs = [buildCrmSegmentSourceRef(input.crmSegmentId)]
  const fingerprint = computeMarketingRequestFingerprint({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    category: 'CAMPAIGN_PREPARATION',
    goal: input.goal,
    brief: input.brief,
    locale: validated.locale,
    audience: input.audienceLabel ?? null,
    sourceRefs,
    seoOpportunityId: null,
    crmSegmentId: input.crmSegmentId,
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
    return idempotentCampaignPreparationResponse({
      existing: existingGlobal,
      crmSegmentId: input.crmSegmentId,
    })
  }

  const segmentOwned = await prisma.crmSegment.findFirst({
    where: { id: input.crmSegmentId, customerAccountId: input.customerAccountId },
    select: { id: true },
  })
  if (!segmentOwned) {
    return { ok: false, code: 'NOT_FOUND', message: 'CRM segment not found for account' }
  }

  const evaluatedAt = new Date()
  const preview = await previewCrmSegmentAudience(input.customerAccountId, input.crmSegmentId, evaluatedAt)
  if (!preview.ok) return preview

  try {
    const created = await prisma.marketingRequest.create({
      data: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        requestType: 'CAMPAIGN_PLAN',
        status: 'DRAFT',
        brief: input.brief,
        locale: validated.locale,
        audience: input.audienceLabel ?? null,
        goal: input.goal,
        sourceRefs,
        artifactIds: [],
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        assignedWorkflow: DEFAULT_WORKFLOW,
        crmSegmentId: input.crmSegmentId,
        audienceEvaluatedAt: evaluatedAt,
        audiencePlanningSummary: preview.value,
        createdByUserId: input.userId,
        statusEvents: {
          create: {
            customerAccountId: input.customerAccountId,
            fromStatus: null,
            toStatus: 'DRAFT',
            actorUserId: input.userId,
            actorType: 'USER',
            reason: 'Campaign preparation draft linked to CRM segment audience (planning only)',
          },
        },
      },
    })
    return {
      ok: true,
      value: {
        requestId: created.id,
        status: created.status,
        crmSegmentId: input.crmSegmentId,
        audiencePreview: preview.value,
      },
    }
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
      return idempotentCampaignPreparationResponse({ existing: raced, crmSegmentId: input.crmSegmentId })
    }
    throw error
  }
}
