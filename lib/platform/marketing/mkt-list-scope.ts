import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function validateMarketingListScope(input: {
  customerAccountId: string
  managedSiteId?: string
  marketingRequestId?: string
  marketingArtifactId?: string
}): Promise<MktResult<true>> {
  if (input.managedSiteId) {
    const site = await prisma.managedSite.findFirst({
      where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
      select: { id: true },
    })
    if (!site) return { ok: false, code: 'VALIDATION', message: 'Unknown managed site for this account' }
  }
  if (input.marketingRequestId) {
    const request = await prisma.marketingRequest.findFirst({
      where: { id: input.marketingRequestId, customerAccountId: input.customerAccountId },
      select: { id: true },
    })
    if (!request) return { ok: false, code: 'VALIDATION', message: 'Unknown marketing request for this account' }
  }
  if (input.marketingArtifactId) {
    const artifact = await prisma.marketingArtifact.findFirst({
      where: { id: input.marketingArtifactId, customerAccountId: input.customerAccountId },
      select: { id: true },
    })
    if (!artifact) return { ok: false, code: 'VALIDATION', message: 'Unknown marketing artifact for this account' }
  }
  return { ok: true, value: true }
}
