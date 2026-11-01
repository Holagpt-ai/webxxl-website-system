import {
  buildGoogleProviderCapabilities,
  googleProviderIngestSupported,
  googleProviderPlatformFlags,
} from '@/lib/platform/google/capabilities'
import { assessGoogleCredentialLifecycle } from '@/lib/platform/google/credential-lifecycle'
import { validateGoogleOAuthSecretRef } from '@/lib/platform/google/credential-ref'
import { validateGooglePropertyRef } from '@/lib/platform/google/property-ref'
import { assessGoogleSitePropertyMapping } from '@/lib/platform/google/site-property-mapping'
import {
  GOOGLE_ANALYTICS_PROVIDERS,
  type GoogleAnalyticsProviderKey,
  type GoogleProviderReadinessRow,
  type GoogleProviderReadinessState,
  type StoredGoogleConnectionSnapshot,
} from '@/lib/platform/google/types'
import { assertSameSeoAccount } from '@/lib/platform/seo/account-isolation'

function resolveReadinessState(input: {
  provider: GoogleAnalyticsProviderKey
  hasConnection: boolean
  lifecycle: string
  ownershipVerified: boolean
  siteMappingOk: boolean
  flags: ReturnType<typeof googleProviderPlatformFlags>
  capabilities: ReturnType<typeof buildGoogleProviderCapabilities>
}): GoogleProviderReadinessState {
  if (!input.flags.readinessModuleEnabled) return 'BLOCKED'
  if (!input.flags.apiEnabled || !input.flags.oauthEnabled) return 'NOT_CONNECTED'
  if (input.provider === 'GBP' && !googleProviderIngestSupported('GBP')) {
    if (!input.hasConnection) return 'NOT_SUPPORTED'
  }
  if (!input.hasConnection) return 'NOT_CONNECTED'
  if (input.lifecycle === 'REVOKED' || input.lifecycle === 'MISSING') return 'BLOCKED'
  if (input.lifecycle === 'INCOMPLETE') return 'PENDING_VERIFICATION'
  if (!input.ownershipVerified || !input.siteMappingOk) return 'PENDING_VERIFICATION'
  if (input.provider === 'GA4' || input.provider === 'GBP') {
    return input.capabilities.providerIngest ? 'READY_FOR_INGEST' : 'NOT_SUPPORTED'
  }
  return 'READY_FOR_INGEST'
}

function pickConnectionForProvider(
  connections: StoredGoogleConnectionSnapshot[],
  provider: GoogleAnalyticsProviderKey,
): StoredGoogleConnectionSnapshot | null {
  const forProvider = connections.filter((c) => c.provider === provider)
  if (forProvider.length === 0) return null

  const active = forProvider.filter((c) => !c.revokedAt)
  const pool = active.length > 0 ? active : [...forProvider].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  if (pool.length > 1) {
    const verified = pool.filter((c) => c.verificationState === 'VERIFIED' && !c.revokedAt)
    if (verified.length === 1) return verified[0]!
    if (active.length > 1) return null
  }
  return pool[0]!
}

export function assessGoogleProviderReadinessRow(input: {
  provider: GoogleAnalyticsProviderKey
  customerAccountId: string
  managedSiteId: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
  connections: StoredGoogleConnectionSnapshot[]
  assessedAt?: Date
}): GoogleProviderReadinessRow {
  const assessedAt = (input.assessedAt ?? new Date()).toISOString()
  const flags = googleProviderPlatformFlags(input.provider)
  const capabilities = buildGoogleProviderCapabilities(input.provider)
  const limitations: string[] = []

  if (!flags.readinessModuleEnabled) {
    limitations.push('GOOGLE_PROVIDER_READINESS_ENABLED is off for this deployment.')
  }
  if (!flags.oauthEnabled) {
    limitations.push('SEO_GOOGLE_OAUTH_ENABLED is off — live OAuth activation is not available.')
  }
  if (!flags.apiEnabled) {
    limitations.push(`Provider API flag disabled for ${input.provider}.`)
  }
  if (input.provider === 'GA4') {
    limitations.push('GA4 live ingest adapter remains unavailable; stored read APIs and readiness only.')
  }
  if (input.provider === 'GBP') {
    limitations.push('GBP live ingest adapter remains unavailable; stored read APIs and readiness only.')
  }

  const connection = pickConnectionForProvider(input.connections, input.provider)
  const sameAccount = connection
    ? assertSameSeoAccount(input.customerAccountId, connection.customerAccountId)
    : { ok: true as const, value: true as const }
  if (!sameAccount.ok) {
    limitations.push(sameAccount.message)
  }
  if (connection && connection.managedSiteId !== input.managedSiteId) {
    limitations.push('Connection managedSiteId does not match assessed site.')
  }

  const lifecycleResult = assessGoogleCredentialLifecycle(connection)
  const lifecycle = lifecycleResult.ok ? lifecycleResult.value.lifecycle : 'MISSING'

  let ownershipVerified = false
  let siteMappingOk = false
  if (connection && sameAccount.ok) {
    ownershipVerified = connection.verificationState === 'VERIFIED' && lifecycle === 'ACTIVE'
    const propertyValid = validateGooglePropertyRef(input.provider, connection.propertyRef)
    if (!propertyValid.ok) {
      limitations.push(propertyValid.message)
    } else {
      const mapping = assessGoogleSitePropertyMapping({
        provider: input.provider,
        propertyRef: propertyValid.value.normalizedRef,
        authorizedHosts: input.authorizedHosts,
        siteCanonicalUrl: input.siteCanonicalUrl,
      })
      if (mapping.ok) {
        siteMappingOk = mapping.value.siteMappingOk
        limitations.push(...mapping.value.limitations)
      }
    }
  }

  const duplicateVerified = input.connections.filter(
    (c) => c.provider === input.provider && c.verificationState === 'VERIFIED' && !c.revokedAt,
  )
  if (duplicateVerified.length > 1) {
    limitations.push('Multiple verified connections for the same provider; select a single property before ingest.')
    siteMappingOk = false
    ownershipVerified = false
  }

  const readinessState = resolveReadinessState({
    provider: input.provider,
    hasConnection: Boolean(connection),
    lifecycle,
    ownershipVerified,
    siteMappingOk,
    flags,
    capabilities,
  })

  const secretRefCheck = connection ? validateGoogleOAuthSecretRef(connection.secretRef) : null
  const secretRefConfigured = Boolean(secretRefCheck?.ok && secretRefCheck.value.configured)

  return {
    provider: input.provider,
    connection: connection
      ? {
          id: connection.id,
          propertyRef: connection.propertyRef,
          propertyKind: connection.propertyKind,
          verificationState: connection.verificationState,
          dataState: connection.dataState,
          lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
          revokedAt: connection.revokedAt?.toISOString() ?? null,
          secretRefConfigured,
        }
      : null,
    platformFlags: flags,
    readinessState,
    ownershipVerified,
    siteMappingOk,
    credentialLifecycle: lifecycle,
    capabilities,
    limitations,
    assessedAt,
    provenance: 'STORED_CONNECTION',
    freshness: {
      connectionUpdatedAt: connection?.updatedAt.toISOString() ?? null,
      lastVerifiedAt: connection?.lastVerifiedAt?.toISOString() ?? null,
    },
  }
}

export function assessGoogleSiteReadiness(input: {
  customerAccountId: string
  managedSiteId: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
  connections: StoredGoogleConnectionSnapshot[]
  assessedAt?: Date
}) {
  const assessedAt = (input.assessedAt ?? new Date()).toISOString()
  const scoped = input.connections.filter(
    (c) => c.managedSiteId === input.managedSiteId && c.customerAccountId === input.customerAccountId,
  )
  return {
    managedSiteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
    providers: GOOGLE_ANALYTICS_PROVIDERS.map((provider) =>
      assessGoogleProviderReadinessRow({
        provider,
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        authorizedHosts: input.authorizedHosts,
        siteCanonicalUrl: input.siteCanonicalUrl,
        connections: scoped,
        assessedAt: input.assessedAt,
      }),
    ),
    assessedAt,
  }
}
