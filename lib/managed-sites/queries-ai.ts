import { prisma } from '@/lib/db'
import { parseAiContentDraftV1 } from '@/lib/managed-sites/ai/schema'
import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'

export async function getCustomerAiContentDraft(input: {
  siteId: string
  customerAccountId: string
  userId: string
}): Promise<{ changeId: string; requestText: string; draft: AiContentDraftV1 } | null> {
  const site = await prisma.managedSite.findFirst({
    where: { id: input.siteId, customerAccountId: input.customerAccountId },
    select: { id: true },
  })
  if (!site) return null

  const change = await prisma.managedSiteChange.findFirst({
    where: {
      managedSiteId: input.siteId,
      requestedById: input.userId,
      capabilityKey: 'content.edit',
      executionMode: 'AI_ASSISTED',
      status: 'DRAFT',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!change?.requestText) return null
  const draft = parseAiContentDraftV1(change.structuredPayload)
  if (!draft) return null
  return { changeId: change.id, requestText: change.requestText, draft }
}
