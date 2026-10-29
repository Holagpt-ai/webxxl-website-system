import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { seoWorkspaceEn, type SeoWorkspaceCopy } from '@/lib/i18n/dictionaries/local-seo-workspace-en'
import { seoWorkspaceEs } from '@/lib/i18n/dictionaries/local-seo-workspace-es'
import type { ManagedSiteOption } from '@/lib/crm-ui/workspace'

export function getSeoCopy(locale: string): SeoWorkspaceCopy {
  return locale === 'es' ? seoWorkspaceEs : seoWorkspaceEn
}

export function seoBase(locale: string) {
  return localizePath(locale as Locale, '/dashboard/seo')
}

/** Sites come from the managed-sites query so the selector renders even while the SEO API is disabled. */
export async function getSeoPageProps(params: Promise<{ locale: string }>) {
  const { locale } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const sites: ManagedSiteOption[] = (await listManagedSitesForAccount(portal.customerAccount.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => ({ id: s.id, name: s.name, domain: s.domain ?? null }))
  return {
    accountId: portal.customerAccount.id,
    locale,
    copy: getSeoCopy(locale),
    base: seoBase(locale),
    marketingBase: localizePath(locale as Locale, '/dashboard/marketing'),
    sites,
  }
}

export type SeoViewProps = Awaited<ReturnType<typeof getSeoPageProps>>
