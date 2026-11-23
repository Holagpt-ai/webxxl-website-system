import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  isSocialExecutionGatesEnabled,
  isSocialMarketingEnabled,
} from '@/config/social-marketing'
import type { BusinessSocialConnection, SocialChannelConnectionState } from '@prisma/client'

export type SocialConnectionAuthorizationRow = {
  connectionId: string
  platform: string
  displayName: string
  connectionState: SocialChannelConnectionState
  oauthConnectAvailable: false
  authorizationState: 'CONNECTED' | 'PENDING' | 'REVOKED' | 'UNAVAILABLE'
  dispatchAllowed: false
  blockReason?: string
}

export type SocialConnectionsAuthorizationContract = {
  assessedAt: string
  moduleEnabled: boolean
  executionGatesEnabled: boolean
  livePublishingEnabled: boolean
  postizApiEnabled: boolean
  oauthConnectEnabled: false
  oauthConnectDeferredReason: string
  providerReadinessPath: '/api/v1/social/provider-readiness'
  rows: SocialConnectionAuthorizationRow[]
}

function authorizationState(state: SocialChannelConnectionState): SocialConnectionAuthorizationRow['authorizationState'] {
  if (state === 'CONNECTED') return 'CONNECTED'
  if (state === 'REVOKED' || state === 'EXPIRED') return 'REVOKED'
  if (state === 'NOT_CONNECTED' || state === 'PENDING_AUTHORIZATION') return 'PENDING'
  return 'UNAVAILABLE'
}

function blockReason(state: SocialChannelConnectionState): string | undefined {
  if (state === 'REVOKED' || state === 'EXPIRED') return 'CHANNEL_REVOKED'
  if (state !== 'CONNECTED') return 'CHANNEL_NOT_CONNECTED'
  if (!isSocialExecutionGatesEnabled()) return 'EXECUTION_GATES_DISABLED'
  if (!isPostizApiEnabled()) return 'POSTIZ_API_DISABLED'
  if (!isPostizLivePublishingEnabled()) return 'LIVE_PUBLISHING_DISABLED'
  return 'OWNER_ACTIVATION_REQUIRED'
}

export function buildSocialConnectionsAuthorizationContract(
  connections: BusinessSocialConnection[],
): SocialConnectionsAuthorizationContract {
  const moduleEnabled = isSocialMarketingEnabled()
  const rows: SocialConnectionAuthorizationRow[] = connections.map((row) => {
    const authState = authorizationState(row.connectionState)
    const reason = blockReason(row.connectionState)
    return {
      connectionId: row.id,
      platform: row.platform,
      displayName: row.displayName,
      connectionState: row.connectionState,
      oauthConnectAvailable: false,
      authorizationState: authState,
      dispatchAllowed: false,
      blockReason: authState === 'CONNECTED' ? reason : reason,
    }
  })

  return {
    assessedAt: new Date().toISOString(),
    moduleEnabled,
    executionGatesEnabled: isSocialExecutionGatesEnabled(),
    livePublishingEnabled: isPostizLivePublishingEnabled(),
    postizApiEnabled: isPostizApiEnabled(),
    oauthConnectEnabled: false,
    oauthConnectDeferredReason:
      'External provider OAuth connect remains owner-gated; use provider-readiness and stored connections only.',
    providerReadinessPath: '/api/v1/social/provider-readiness',
    rows,
  }
}