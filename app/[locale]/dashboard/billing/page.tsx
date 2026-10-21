import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle } from '@/components/dashboard/primitives'
import { BillingView } from '@/components/commerce/billing-view'

export const dynamic = 'force-dynamic'

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const copy = dict.commerce

  // Only ids and names are read here for the group picker; every figure on the page
  // comes from the role-checked commerce endpoints.
  const memberships = await prisma.billingGroupMembership.findMany({
    where: { customerAccountId: portal.customerAccount.id, status: { in: ['ACTIVE', 'PENDING'] } },
    orderBy: { createdAt: 'asc' },
    select: { billingGroup: { select: { id: true, name: true } } },
  })
  const groups = Array.from(new Map(memberships.map((m) => [m.billingGroup.id, m.billingGroup])).values())

  return (
    <>
      <PageTitle title={copy.billing.title} description={copy.billing.description} />
      <BillingView
        groups={groups}
        locale={locale}
        copy={copy}
        loginHref={localizePath(locale as Locale, '/login')}
        supportHref={localizePath(locale as Locale, '/dashboard/support')}
      />
    </>
  )
}
