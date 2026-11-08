import type { PostizProviderReadinessDto } from '@/lib/platform/social/postiz-provider-readiness'
import {
  PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
  PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE,
} from '@/lib/platform/marketing-execution/constants'
import type { MarketingSocialChannelSummary } from '@/lib/platform/marketing-execution/types'

export function mapPostizReadinessForExecutionSummary(value: PostizProviderReadinessDto): {
  assessedAt: string
  moduleEnabled: boolean
  postizApiEnabled: boolean
  livePublishingEnabled: boolean
  credentialsConfigured: boolean
  workspaceConnected: boolean
  dispatchBlockedCode: string
  dispatchBlockedMessage: string
  channels: MarketingSocialChannelSummary[]
} {
  const flagEvidence = `POSTIZ_LIVE_PUBLISHING_ENABLED=${value.livePublishingEnabled}; POSTIZ_API_ENABLED=${value.postizApiEnabled}.`
  return {
    assessedAt: value.assessedAt,
    moduleEnabled: value.moduleEnabled,
    postizApiEnabled: value.postizApiEnabled,
    livePublishingEnabled: value.livePublishingEnabled,
    credentialsConfigured: value.credentialsConfigured,
    workspaceConnected: value.workspaceConnected,
    dispatchBlockedCode: PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
    dispatchBlockedMessage: `${PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE} (${flagEvidence})`,
    channels: value.channels.map((row) => ({
      connectionId: row.connectionId,
      platform: row.platform,
      displayName: row.displayName,
      connectionState: row.connectionState,
      dispatchAllowed: false,
      blockReason: row.blockReason ?? PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
    })),
  }
}
