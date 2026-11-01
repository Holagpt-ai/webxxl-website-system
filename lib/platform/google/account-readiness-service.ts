import { GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT, isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import { assessGoogleSiteReadiness } from '@/lib/platform/google/readiness-assess'
import type { GoogleAccountReadinessDto } from '@/lib/platform/google/types'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'
import { prisma } from '@/lib/db'
import { loadGoogleConnectionsForAccount } from '@/lib/platform/google/prisma-load'

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

  const connections = await loadGoogleConnectionsForAccount({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
  })

  let sitesTotal: number | undefined
  let sitesTruncated = false
  const allSiteIds = input.managedSiteId
    ? [input.managedSiteId]
    : (
        await prisma.managedSite.findMany({
          where: { customerAccountId: input.customerAccountId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
      ).map((s) => s.id)

  let sites = allSiteIds
  if (!input.managedSiteId && allSiteIds.length > GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT) {
    sitesTotal = allSiteIds.length
    sitesTruncated = true
    sites = allSiteIds.slice(0, GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT)
  }

  const assessedAt = new Date()
  const siteDtos = []
  for (const siteId of sites) {
    const site = await requireManagedSiteInAccount({
      siteId,
      customerAccountId: input.customerAccountId,
    })
    if (!site.ok) continue
    let siteCanonicalUrl: string | null = null
    if (site.value.domain) {
      siteCanonicalUrl = site.value.domain.startsWith('http') ? site.value.domain : `https://${site.value.domain}`
    }
    siteDtos.push(
      assessGoogleSiteReadiness({
        customerAccountId: input.customerAccountId,
        managedSiteId: siteId,
        authorizedHosts: site.value.authorizedHosts,
        siteCanonicalUrl,
        connections,
        assessedAt,
      }),
    )
  }

  return {
    ok: true,
    value: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      sites: siteDtos,
      assessedAt: assessedAt.toISOString(),
      ...(sitesTruncated
        ? {
            sitesTruncated: true,
            sitesReturned: siteDtos.length,
            sitesTotal,
          }
        : {}),
    },
  }
}
