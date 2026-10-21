import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { EmptyState, PageTitle } from '@/components/dashboard/primitives'
import { AnalyticsView } from '@/components/analytics/analytics-view'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const copy = dict.analytics

  // The API defaults to the oldest site when none is given; preselect it so the filter matches.
  const sites = (await listManagedSitesForAccount(portal.customerAccount.id))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => ({ id: s.id, name: s.name, domain: s.domain ?? null }))

  return (
    <>
      <PageTitle title={copy.title} description={copy.description} />
      {sites.length === 0 ? (
        <EmptyState title={copy.noSites.title} body={copy.noSites.body} />
      ) : (
        <AnalyticsView
          accountId={portal.customerAccount.id}
          sites={sites}
          locale={locale}
          copy={copy}
          loginHref={localizePath(locale as Locale, '/login')}
        />
      )}
    </>
  )
}
