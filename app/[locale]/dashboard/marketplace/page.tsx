import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { PageTitle } from '@/components/dashboard/primitives'
import { MarketplaceView } from '@/components/commerce/marketplace-view'

export const dynamic = 'force-dynamic'

export default async function MarketplacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const copy = dict.commerce

  return (
    <>
      <PageTitle title={copy.marketplace.title} description={copy.marketplace.description} />
      <MarketplaceView
        accountId={portal.customerAccount.id}
        locale={locale}
        copy={copy}
        loginHref={localizePath(locale as Locale, '/login')}
      />
    </>
  )
}
