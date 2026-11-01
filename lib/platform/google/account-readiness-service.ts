import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import {
  loadBoundedAccountReadinessSites,
  loadSingleAccountReadinessSite,
} from '@/lib/platform/google/account-readiness-load'
import { assessGoogleSiteReadiness } from '@/lib/platform/google/readiness-assess'
import type { GoogleAccountReadinessDto } from '@/lib/platform/google/types'
import { loadGoogleConnectionsForSites } from '@/lib/platform/google/prisma-load'

export async function buildGoogleAccountReadiness(input: {
  customerAccountId: string
  managedSiteId: string | null
}): Promise<{ ok: true; value: GoogleAccountReadinessDto } | { ok: false; status: number; code: string; message: string }> {
  if (!isGoogleProviderReadinessEnabled()) {
    return {
      ok: false,
      status: 503,
      code: 'NOT_CONFIGURED',
      message: 'Google provider readiness module disabled',
    }
  }

  const assessedAt = new Date()

  if (input.managedSiteId) {
    const site = await loadSingleAccountReadinessSite({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
    })
    if (!site.ok) {
      return {
        ok: false,
        status: site.code === 'NOT_FOUND' ? 404 : 400,
        code: site.code,
        message: site.message,
      }
    }
    const connections = await loadGoogleConnectionsForSites({
      customerAccountId: input.customerAccountId,
      managedSiteIds: [site.value.id],
    })
    const siteDto = assessGoogleSiteReadiness({
      customerAccountId: input.customerAccountId,
      managedSiteId: site.value.id,
      authorizedHosts: site.value.authorizedHosts,
      siteCanonicalUrl: site.value.siteCanonicalUrl,
      connections,
      assessedAt,
    })
    return {
      ok: true,
      value: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        sites: [siteDto],
        assessedAt: assessedAt.toISOString(),
      },
    }
  }

  const bounded = await loadBoundedAccountReadinessSites(input.customerAccountId)
  const siteIds = bounded.sites.map((s) => s.id)
  const connections = await loadGoogleConnectionsForSites({
    customerAccountId: input.customerAccountId,
    managedSiteIds: siteIds,
  })

  const siteDtos = bounded.sites.map((site) =>
    assessGoogleSiteReadiness({
      customerAccountId: input.customerAccountId,
      managedSiteId: site.id,
      authorizedHosts: site.authorizedHosts,
      siteCanonicalUrl: site.siteCanonicalUrl,
      connections,
      assessedAt,
    }),
  )

  return {
    ok: true,
    value: {
      customerAccountId: input.customerAccountId,
      managedSiteId: null,
      sites: siteDtos,
      assessedAt: assessedAt.toISOString(),
      ...(bounded.sitesTruncated
        ? {
            sitesTruncated: true,
            sitesReturned: siteDtos.length,
            sitesTotal: bounded.sitesTotal,
          }
        : {}),
    },
  }
}
