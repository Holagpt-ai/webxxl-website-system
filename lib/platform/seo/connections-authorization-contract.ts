import {
  isSeoGa4ApiEnabled,
  isSeoGbpApiEnabled,
  isSeoGoogleOauthEnabled,
  isSeoGscApiEnabled,
} from '@/config/seo-backend'

export type SeoConnectionAuthorizationRow = {
  connectionId: string
  provider: string
  verificationState: string
  dataState: string
  oauthConnectAvailable: false
  authorizationState: 'VERIFIED' | 'PENDING' | 'REVOKED' | 'DISCONNECTED'
  dispatchAllowed: false
  blockReason?: string
}

export type SeoConnectionsAuthorizationContract = {
  assessedAt: string
  oauthConnectEnabled: false
  oauthHandoffPath: string
  googleReadinessPath: string
  providerFlags: {
    gscApiEnabled: boolean
    ga4ApiEnabled: boolean
    gbpApiEnabled: boolean
    googleOauthEnabled: boolean
  }
  rows: SeoConnectionAuthorizationRow[]
}

function authorizationState(verification: string, dataState: string, revokedAt: Date | null): SeoConnectionAuthorizationRow['authorizationState'] {
  if (revokedAt || verification === 'REVOKED') return 'REVOKED'
  if (verification === 'VERIFIED' && dataState !== 'NOT_CONNECTED') return 'VERIFIED'
  if (dataState === 'NOT_CONNECTED') return 'DISCONNECTED'
  return 'PENDING'
}

function blockReason(provider: string): string | undefined {
  if (!isSeoGoogleOauthEnabled()) return 'SEO_GOOGLE_OAUTH_ENABLED is false'
  if (provider === 'GSC' && !isSeoGscApiEnabled()) return 'SEO_GSC_API_ENABLED is false'
  if (provider === 'GA4' && !isSeoGa4ApiEnabled()) return 'SEO_GA4_API_ENABLED is false'
  if (provider === 'GBP' && !isSeoGbpApiEnabled()) return 'SEO_GBP_API_ENABLED is false'
  return 'OWNER_ACTIVATION_REQUIRED'
}

export function buildSeoConnectionsAuthorizationContract(
  managedSiteId: string,
  connections: Array<{
    id: string
    provider: string
    verificationState: string
    dataState: string
    revokedAt: Date | null
  }>,
): SeoConnectionsAuthorizationContract {
  const base = `/api/v1/seo/sites/${managedSiteId}`
  return {
    assessedAt: new Date().toISOString(),
    oauthConnectEnabled: false,
    oauthHandoffPath: `${base}/google/oauth-handoff`,
    googleReadinessPath: `${base}/google/readiness`,
    providerFlags: {
      gscApiEnabled: isSeoGscApiEnabled(),
      ga4ApiEnabled: isSeoGa4ApiEnabled(),
      gbpApiEnabled: isSeoGbpApiEnabled(),
      googleOauthEnabled: isSeoGoogleOauthEnabled(),
    },
    rows: connections.map((row) => {
      const authState = authorizationState(row.verificationState, row.dataState, row.revokedAt)
      return {
        connectionId: row.id,
        provider: row.provider,
        verificationState: row.verificationState,
        dataState: row.dataState,
        oauthConnectAvailable: false,
        authorizationState: authState,
        dispatchAllowed: false,
        blockReason: authState === 'VERIFIED' ? blockReason(row.provider) : undefined,
      }
    }),
  }
}