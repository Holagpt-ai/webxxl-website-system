import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'
import { normalizeHostname } from '@/lib/platform/seo/crawl-authorization'
import type { SeoResult } from '@/lib/platform/seo/types'

export function resolveAuthorizedCrawlHosts(input: {
  domain: string | null
  canonicalHost?: string | null
  approvedAliases?: string[]
}): string[] {
  const hosts = new Set<string>()
  if (input.domain) {
    try {
      const u = new URL(input.domain.startsWith('http') ? input.domain : `https://${input.domain}`)
      hosts.add(normalizeHostname(u.hostname))
    } catch {
      hosts.add(normalizeHostname(input.domain.replace(/^https?:\/\//, '').split('/')[0] ?? input.domain))
    }
  }
  if (input.canonicalHost) hosts.add(normalizeHostname(input.canonicalHost))
  for (const alias of input.approvedAliases ?? []) {
    hosts.add(normalizeHostname(alias))
  }
  return [...hosts]
}

export async function requireManagedSiteInAccount(input: {
  siteId: string
  customerAccountId: string
}): Promise<
  SeoResult<{
    id: string
    customerAccountId: string
    domain: string | null
    name: string
    authorizedHosts: string[]
  }>
> {
  const site = await getManagedSiteForAccount(input.siteId, input.customerAccountId)
  if (!site) return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found for account' }
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
  return {
    ok: true,
    value: {
      id: site.id,
      customerAccountId: site.customerAccountId,
      domain: site.domain,
      name: site.name,
      authorizedHosts,
    },
  }
}
