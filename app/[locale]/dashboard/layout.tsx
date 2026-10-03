import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { DashboardShell } from '@/components/dashboard/shell'

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
  const session = await getSession()
  if (!session) redirect('/login')
  const dict = getDictionary(locale)
  return (
    <DashboardShell locale={locale} dict={dict.dashboard} userEmail={session.email}>
      {children}
    </DashboardShell>
  )
}
