import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  isSocialExecutionGatesEnabled,
  isSocialMarketingEnabled,
  postizApiSecretRef,
} from '@/config/social-marketing'
import { prisma } from '@/lib/db'

export type PostizChannelReadinessRow = {
  connectionId: string
  platform: string
  displayName: string
  connectionState: string
  externalChannelRef: string
  dispatchAllowed: boolean
  blockReason?: string
}

export type PostizProviderReadinessDto = {
  customerAccountId: string
  assessedAt: string
  moduleEnabled: boolean
  postizApiEnabled: boolean
  livePublishingEnabled: boolean
  credentialsConfigured: boolean
  workspaceConnected: boolean
  channels: PostizChannelReadinessRow[]
  dispatchBlockedCode: string
  dispatchBlockedMessage: string
}

function channelBlockReason(state: string): string | undefined {
  if (state === 'REVOKED' || state === 'EXPIRED') return 'CHANNEL_REVOKED'
  if (state !== 'CONNECTED') return 'CHANNEL_NOT_CONNECTED'
  return undefined
}

export async function buildPostizProviderReadiness(
  customerAccountId: string,
): Promise<
  | { ok: true; value: PostizProviderReadinessDto }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!isSocialExecutionGatesEnabled()) {
    return {
      ok: false,
      status: 503,
      code: 'NOT_CONFIGURED',
      message: 'SOCIAL_EXECUTION_GATES_ENABLED is false',
    }
  }
  if (!isSocialMarketingEnabled()) {
    return {
      ok: false,
      status: 503,
      code: 'SOCIAL_MARKETING_DISABLED',
      message: 'Marketing Studio disabled',
    }
  }

  const assessedAt = new Date()
  const connections = await prisma.businessSocialConnection.findMany({
    where: { customerAccountId, providerKey: 'postiz' },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const channels: PostizChannelReadinessRow[] = connections.map((row) => {
    const blockReason = channelBlockReason(row.connectionState)
    return {
      connectionId: row.id,
      platform: row.platform,
      displayName: row.displayName,
      connectionState: row.connectionState,
      externalChannelRef: row.externalChannelRef,
      dispatchAllowed: blockReason === undefined && isPostizApiEnabled() && isPostizLivePublishingEnabled(),
      blockReason,
    }
  })

  const workspaceConnected = connections.some((row) => row.connectionState === 'CONNECTED')
  const dispatchBlockedCode = isPostizLivePublishingEnabled()
    ? isPostizApiEnabled()
      ? 'LIVE_DISPATCH_AUTHORIZED_AT_FLAG'
      : 'POSTIZ_API_DISABLED'
    : 'LIVE_PUBLISHING_DISABLED'

  const dispatchBlockedMessage = isPostizLivePublishingEnabled()
    ? isPostizApiEnabled()
      ? 'Live publishing flag is on; owner pilot authorization still required at schedule route'
      : 'POSTIZ_API_ENABLED is false'
    : 'POSTIZ_LIVE_PUBLISHING_ENABLED is false; scheduling prep only'

  return {
    ok: true,
    value: {
      customerAccountId,
      assessedAt: assessedAt.toISOString(),
      moduleEnabled: true,
      postizApiEnabled: isPostizApiEnabled(),
      livePublishingEnabled: isPostizLivePublishingEnabled(),
      credentialsConfigured: Boolean(postizApiSecretRef()),
      workspaceConnected,
      channels,
      dispatchBlockedCode,
      dispatchBlockedMessage,
    },
  }
}
