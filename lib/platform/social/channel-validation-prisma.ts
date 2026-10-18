import { prisma } from '@/lib/db'
import type { SocialResult } from '@/lib/platform/social/types'

export async function validateTargetChannelIdsForAccountPrisma(
  customerAccountId: string,
  managedSiteId: string | undefined,
  targetChannelIds: string[],
): Promise<SocialResult<true>> {
  for (const channelId of targetChannelIds) {
    const connection = await prisma.businessSocialConnection.findFirst({
      where: { id: channelId, customerAccountId },
    })
    if (!connection) {
      return { ok: false, code: 'CHANNEL_NOT_FOUND', message: 'Target channel not found' }
    }
    if (managedSiteId && connection.managedSiteId && connection.managedSiteId !== managedSiteId) {
      return {
        ok: false,
        code: 'SITE_SCOPE_MISMATCH',
        message: 'Target channel is not authorized for managed site scope',
      }
    }
    if (connection.connectionState === 'REVOKED' || connection.connectionState === 'EXPIRED') {
      return { ok: false, code: 'CHANNEL_REVOKED', message: 'Target channel is not active' }
    }
  }
  return { ok: true, value: true }
}
