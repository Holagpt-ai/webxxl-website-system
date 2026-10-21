import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { PageTitle } from '@/components/dashboard/primitives'
import { WorkforceView } from '@/components/ai-employees/workforce-view'

export const dynamic = 'force-dynamic'

export default async function AiEmployeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const copy = dict.aiEmployees

  return (
    <>
      <PageTitle title={copy.title} description={copy.description} />
      <WorkforceView
        accountId={portal.customerAccount.id}
        accountName={portal.customerAccount.businessName}
        locale={locale}
        copy={copy}
        loginHref={localizePath(locale as Locale, '/login')}
      />
    </>
  )
}
