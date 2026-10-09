import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { DashboardShell } from '@/components/dashboard/shell'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getDashboardNavModules } from '@/lib/portal/modules'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  return {
    ...buildMetadata({ locale, path: '/dashboard', title: dict.dashboard.title }),
    robots: { index: false },
  }
}

export default async function DashboardLayout({ params, children }: Props) {
  const locale = await resolveLocale(params)
  const session = await auth()
  if (!session?.user) redirect(locale === 'es' ? '/es/login' : '/login')

  let portal
  try {
    portal = await requireCustomerMembership()
  } catch {
    redirect(locale === 'es' ? '/es/login' : '/login')
  }

  const services = await prisma.customerService.findMany({
    where: { customerAccountId: portal.customerAccount.id, status: 'ACTIVE' },
  })
  const activeKeys = new Set(services.map((s) => s.serviceKey))
  const dict = getDictionary(locale)
  const navModules = getDashboardNavModules()

  return (
    <DashboardShell
      locale={locale}
      dict={dict.dashboard}
      businessName={portal.customerAccount.businessName}
      userEmail={portal.email}
      navModules={navModules}
    >
      {children}
    </DashboardShell>
  )
}
