import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { marketingStudioEn, type MarketingStudioCopy } from '@/lib/i18n/dictionaries/marketing-studio-en'
import { marketingStudioEs } from '@/lib/i18n/dictionaries/marketing-studio-es'
import type { ManagedSiteOption } from '@/lib/crm-ui/workspace'

export function getMarketingCopy(locale: string): MarketingStudioCopy {
  return locale === 'es' ? marketingStudioEs : marketingStudioEn
}

export function marketingBase(locale: string) {
  return localizePath(locale as Locale, '/dashboard/marketing')
}

/** Account and user come from the session membership; sites come from the managed-sites query, not the SEO API. */
export async function getMarketingPageProps(params: Promise<{ locale: string }>) {
  const { locale } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const sites: ManagedSiteOption[] = (await listManagedSitesForAccount(portal.customerAccount.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => ({ id: s.id, name: s.name, domain: s.domain ?? null }))
  return {
    accountId: portal.customerAccount.id,
    userId: portal.id,
    locale,
    copy: getMarketingCopy(locale),
    base: marketingBase(locale),
    seoBase: localizePath(locale as Locale, '/dashboard/seo'),
    sites,
  }
}

export type MarketingViewProps = Awaited<ReturnType<typeof getMarketingPageProps>>
