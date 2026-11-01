import { prisma } from '@/lib/db'
import type { StoredGoogleConnectionSnapshot } from '@/lib/platform/google/types'

export async function loadGoogleConnectionsForAccount(input: {
  customerAccountId: string
  managedSiteId?: string | null
}): Promise<StoredGoogleConnectionSnapshot[]> {
  if (input.managedSiteId) {
    return loadGoogleConnectionsForSites({
      customerAccountId: input.customerAccountId,
      managedSiteIds: [input.managedSiteId],
    })
  }
  return []
}

export async function loadGoogleConnectionsForSites(input: {
  customerAccountId: string
  managedSiteIds: string[]
}): Promise<StoredGoogleConnectionSnapshot[]> {
  if (input.managedSiteIds.length === 0) return []
  const rows = await prisma.siteAnalyticsConnection.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: { in: input.managedSiteIds },
      provider: { in: ['GSC', 'GA4', 'GBP'] },
    },
  })
  return rows.map((c) => ({
    id: c.id,
    managedSiteId: c.managedSiteId,
    customerAccountId: c.customerAccountId,
    provider: c.provider as StoredGoogleConnectionSnapshot['provider'],
    propertyRef: c.propertyRef,
    propertyKind: c.propertyKind,
    verificationState: c.verificationState,
    dataState: c.dataState,
    lastVerifiedAt: c.lastVerifiedAt,
    revokedAt: c.revokedAt,
    secretRef: c.secretRef,
    updatedAt: c.updatedAt,
  }))
}
