import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import { assessGoogleSiteReadiness } from '@/lib/platform/google/readiness-assess'
import { loadGoogleConnectionsForAccount } from '@/lib/platform/google/prisma-load'
import type { GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'

export type GoogleOAuthHandoffProviderRow = {
  provider: GoogleAnalyticsProviderKey
  readinessState: string
  oauthStartAvailable: false
  blockedReason?: string
  readinessAssessPath: string
  assessOperationPath: string
}

export type GoogleOAuthHandoffContract = {
  managedSiteId: string
  customerAccountId: string
  assessedAt: string
  oauthConnectionEnabled: false
  oauthStartDeferredReason: string
  readinessModuleEnabled: boolean
  providers: GoogleOAuthHandoffProviderRow[]
  limitations: string[]
}

export async function buildGoogleOAuthHandoffContract(input: {
  customerAccountId: string
  managedSiteId: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
}): Promise<GoogleOAuthHandoffContract> {
  const connections = await loadGoogleConnectionsForAccount({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
  })
  const readiness = assessGoogleSiteReadiness({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    authorizedHosts: input.authorizedHosts,
    siteCanonicalUrl: input.siteCanonicalUrl,
    connections,
  })

  const basePath = `/api/v1/seo/sites/${input.managedSiteId}/google`
  const providers: GoogleOAuthHandoffProviderRow[] = readiness.providers.map((row) => {
    let blockedReason: string | undefined
    if (!row.platformFlags.oauthEnabled) {
      blockedReason = 'SEO_GOOGLE_OAUTH_ENABLED is false'
    } else if (row.readinessState === 'BLOCKED') {
      blockedReason = 'Provider readiness blocked'
    } else if (row.readinessState === 'NOT_SUPPORTED') {
      blockedReason = 'Provider ingest not supported in current release'
    }
    return {
      provider: row.provider as GoogleAnalyticsProviderKey,
      readinessState: row.readinessState,
      oauthStartAvailable: false,
      blockedReason,
      readinessAssessPath: `${basePath}/readiness`,
      assessOperationPath: `${basePath}/readiness/assess`,
    }
  })

  const limitations = [
    'Customer OAuth start is not exposed; owner authorization is required before live Google connection.',
    'Use readiness GET and bounded assess POST for stored connection state only.',
  ]
  if (!isGoogleProviderReadinessEnabled()) {
    limitations.unshift('GOOGLE_PROVIDER_READINESS_ENABLED is false for this deployment.')
  }

  return {
    managedSiteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
    assessedAt: readiness.assessedAt,
    oauthConnectionEnabled: false,
    oauthStartDeferredReason:
      'Google OAuth connect HTTP is owner-gated. Readiness contracts document provider state without starting OAuth.',
    readinessModuleEnabled: isGoogleProviderReadinessEnabled(),
    providers,
    limitations,
  }
}