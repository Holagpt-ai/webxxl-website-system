import { GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT } from '@/config/google-integration'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'
import { resolveAuthorizedCrawlHosts } from '@/lib/platform/seo/site-scope'
import { normalizeHostname } from '@/lib/platform/seo/crawl-authorization'
import { prisma } from '@/lib/db'
import type { SeoResult } from '@/lib/platform/seo/types'

export type AccountReadinessSiteRow = {
  id: string
  customerAccountId: string
  domain: string | null
  name: string
  authorizedHosts: string[]
  siteCanonicalUrl: string | null
}

function hostsForManagedSite(site: { domain: string | null; canonicalUrl: string }): SeoResult<string[]> {
  let canonicalHost: string | null = null
  try {
    const canonical = new URL(site.canonicalUrl.startsWith('http') ? site.canonicalUrl : `https://${site.canonicalUrl}`)
    canonicalHost = normalizeHostname(canonical.hostname)
  } catch {
    canonicalHost = null
  }
  const authorizedHosts = resolveAuthorizedCrawlHosts({
    domain: site.domain,
    canonicalHost,
  })
  if (authorizedHosts.length === 0) {
    return { ok: false, code: 'VALIDATION', message: 'Managed site has no verifiable public host' }
  }
  return { ok: true, value: authorizedHosts }
}

export function toAccountReadinessSiteRow(site: {
  id: string
  customerAccountId: string
  domain: string | null
  name: string
  canonicalUrl: string
}): SeoResult<AccountReadinessSiteRow> {
  const hosts = hostsForManagedSite(site)
  if (!hosts.ok) return hosts
  let siteCanonicalUrl: string | null = null
  if (site.domain) {
    siteCanonicalUrl = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`
  }
  return {
    ok: true,
    value: {
      id: site.id,
      customerAccountId: site.customerAccountId,
      domain: site.domain,
      name: site.name,
      authorizedHosts: hosts.value,
      siteCanonicalUrl,
    },
  }
}

/** Account-wide readiness: at most N sites from DB (+ lookahead); count only when truncated. */
export async function loadBoundedAccountReadinessSites(customerAccountId: string): Promise<{
  sites: AccountReadinessSiteRow[]
  sitesTruncated: boolean
  sitesTotal?: number
}> {
  const limit = GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT
  const peek = await prisma.managedSite.findMany({
    where: { customerAccountId },
    select: { id: true, customerAccountId: true, domain: true, name: true, canonicalUrl: true },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
  })

  const truncated = peek.length > limit
  const selected = truncated ? peek.slice(0, limit) : peek
  const sites: AccountReadinessSiteRow[] = []
  for (const row of selected) {
    const parsed = toAccountReadinessSiteRow(row)
    if (parsed.ok) sites.push(parsed.value)
  }

  if (!truncated) {
    return { sites, sitesTruncated: false }
  }

  const sitesTotal = await prisma.managedSite.count({ where: { customerAccountId } })
  return { sites, sitesTruncated: true, sitesTotal }
}

export async function loadSingleAccountReadinessSite(input: {
  customerAccountId: string
  managedSiteId: string
}): Promise<SeoResult<AccountReadinessSiteRow>> {
  const site = await getManagedSiteForAccount(input.managedSiteId, input.customerAccountId)
  if (!site) return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found for account' }
  return toAccountReadinessSiteRow({
    id: site.id,
    customerAccountId: site.customerAccountId,
    domain: site.domain,
    name: site.name,
    canonicalUrl: site.canonicalUrl,
  })
}
