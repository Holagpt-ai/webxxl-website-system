import { matchGscPropertyToSite, denyForeignGoogleProperty } from '@/lib/platform/seo/property-match'
import { validateGscSearchAnalyticsRequest } from '@/lib/platform/seo/gsc-request-validate'
import type { GscSearchAnalyticsRequest } from '@/lib/platform/seo/gsc-types'
import type { SeoResult } from '@/lib/platform/seo/types'

export type GscConnectionRecord = {
  customerAccountId: string
  managedSiteId: string
  propertyRef: string
  verificationState: string
  dataState: string
  secretRef: string | null
  revokedAt: Date | null
}

export function authorizeGscSearchAnalyticsQuery(input: {
  contextAccountId: string
  contextManagedSiteId?: string
  connection: GscConnectionRecord | null
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
  request: GscSearchAnalyticsRequest
  requestedPropertyRef?: string
}): SeoResult<{ propertyRef: string; secretRef: string }> {
  if (!input.connection) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'No GSC connection for site' }
  }
  if (input.connection.customerAccountId !== input.contextAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'GSC connection account mismatch' }
  }
  if (input.connection.revokedAt || input.connection.verificationState === 'REVOKED') {
    return { ok: false, code: 'FORBIDDEN', message: 'GSC connection revoked' }
  }
  if (input.connection.verificationState !== 'VERIFIED') {
    return { ok: false, code: 'FORBIDDEN', message: 'GSC connection not verified' }
  }
  if (input.connection.dataState === 'NOT_CONNECTED') {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'GSC connection not active' }
  }
  if (input.contextManagedSiteId && input.connection.managedSiteId !== input.contextManagedSiteId) {
    return { ok: false, code: 'FORBIDDEN', message: 'GSC connection site mismatch' }
  }
  const propertyRef = input.requestedPropertyRef ?? input.connection.propertyRef
  const foreign = denyForeignGoogleProperty({
    connectionAccountId: input.connection.customerAccountId,
    requestAccountId: input.contextAccountId,
    propertyRef,
    authorizedPropertyRefs: [input.connection.propertyRef],
  })
  if (!foreign.ok) return foreign
  const siteMatch = matchGscPropertyToSite({
    propertyRef,
    authorizedHosts: input.authorizedHosts,
    siteCanonicalUrl: input.siteCanonicalUrl,
  })
  if (!siteMatch.ok) return siteMatch
  if (!input.connection.secretRef) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'GSC OAuth secret reference missing' }
  }
  const req = validateGscSearchAnalyticsRequest(input.request)
  if (!req.ok) return req
  return { ok: true, value: { propertyRef, secretRef: input.connection.secretRef } }
}
