import { prisma } from '@/lib/db'
import { createMarketingRequestRecord } from '@/lib/platform/marketing/request-service'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function createMarketingRequestFromSeoOpportunity(input: {
  customerAccountId: string
  userId: string
  managedSiteId: string
  seoOpportunityId: string
  idempotencyKey: string
}): Promise<MktResult<{ requestId: string }>> {
  const opportunity = await prisma.seoOpportunity.findFirst({
    where: {
      id: input.seoOpportunityId,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
    },
  })
  if (!opportunity) return { ok: false, code: 'NOT_FOUND', message: 'SEO opportunity not found for site' }

  const created = await createMarketingRequestRecord({
    customerAccountId: input.customerAccountId,
    userId: input.userId,
    managedSiteId: input.managedSiteId,
    category: 'SEO_CONTENT_FIX',
    goal: opportunity.recommendation,
    brief: `${opportunity.impactRationale}\nEvidence: ${opportunity.evidenceRef}`,
    locale: 'en',
    sourceRefs: [opportunity.evidenceRef],
    idempotencyKey: input.idempotencyKey,
    seoOpportunityId: opportunity.id,
  })
  if (!created.ok) return created
  return { ok: true, value: { requestId: created.value.requestId } }
}
