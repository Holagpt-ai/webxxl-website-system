import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import { prisma } from '@/lib/db'
import { PageTitle } from '@/components/dashboard/primitives'
import { AdminCommerceView } from '@/components/commerce/admin-commerce-view'

export const dynamic = 'force-dynamic'

export default async function AdminCommercePage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const copy = getDictionary(locale).commerce
  const groups = await prisma.billingGroup.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })

  return (
    <>
      <PageTitle title={copy.admin.title} description={copy.admin.description} />
      <AdminCommerceView groups={groups} locale={locale} copy={copy} loginHref={localizePath(locale, '/login')} />
    </>
  )
}
