import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { DashboardShell } from '@/components/dashboard/shell'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getActiveProjectIdFromCookie, pickActiveProject } from '@/lib/portal/active-project'
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

  if (session.user.role === 'STAFF' || session.user.role === 'ADMIN') {
    redirect(locale === 'es' ? '/es/admin' : '/admin')
  }

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
  const accountMemberships = await prisma.customerMembership.findMany({
    where: { userId: portal.id },
    include: { customerAccount: { select: { id: true, businessName: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const accountOptions = accountMemberships.map((m) => ({
    customerAccountId: m.customerAccount.id,
    businessName: m.customerAccount.businessName,
  }))
  const projects = await prisma.project.findMany({
    where: { customerAccountId: portal.customerAccount.id },
    select: { id: true, name: true, status: true, updatedAt: true },
    orderBy: { name: 'asc' },
  })
  const activeProject = pickActiveProject(projects, await getActiveProjectIdFromCookie()).project

  return (
    <DashboardShell
      locale={locale}
      dict={dict.dashboard}
      languageLabel={dict.common.language}
      businessName={portal.customerAccount.businessName}
      userEmail={portal.email}
      navModules={navModules}
      accountOptions={accountOptions.length > 1 ? accountOptions : undefined}
      activeAccountId={portal.customerAccount.id}
      projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
      activeProjectId={activeProject?.id}
    >
      {children}
    </DashboardShell>
  )
}
