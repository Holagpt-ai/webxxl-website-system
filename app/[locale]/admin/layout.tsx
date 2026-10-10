import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { resolveLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { AdminShell } from '@/components/admin/shell'
import { AuthError, requireStaff } from '@/lib/portal/authz'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return {
    ...buildMetadata({ locale, path: '/admin', title: 'WebXXL Admin' }),
    robots: { index: false, follow: false },
  }
}

export default async function AdminLayout({ params, children }: Props) {
  const locale = await resolveLocale(params)
  const session = await auth()
  const loginPath = locale === 'es' ? '/es/login' : '/login'
  const dashboardPath = locale === 'es' ? '/es/dashboard' : '/dashboard'

  if (!session?.user) redirect(loginPath)

  if (session.user.role === 'CUSTOMER') {
    redirect(dashboardPath)
  }

  let staffUser
  try {
    staffUser = await requireStaff()
  } catch (e) {
    if (e instanceof AuthError) redirect(loginPath)
    throw e
  }

  const roleLabel = staffUser.role === 'ADMIN' ? 'Admin' : 'Staff'

  return (
    <AdminShell locale={locale} userEmail={staffUser.email} roleLabel={roleLabel}>
      {children}
    </AdminShell>
  )
}
