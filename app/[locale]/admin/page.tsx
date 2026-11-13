import Link from 'next/link'
import { getAdminDashboardStats } from '@/lib/admin/queries'
import { PageTitle, SectionCard } from '@/components/dashboard/primitives'
import { AdminOperationsSummary } from '@/components/admin/operations-summary'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { adminOperationsEn } from '@/lib/i18n/dictionaries/admin-operations-en'
import { adminOperationsEs } from '@/lib/i18n/dictionaries/admin-operations-es'
import { localizeStoredActivity } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const a = dict.admin
  const stats = await getAdminDashboardStats()
  const prefix = locale === 'es' ? '/es' : ''
  const opsCopy = locale === 'es' ? adminOperationsEs : adminOperationsEn

  return (
    <>
      <PageTitle title={a.overview.title} description={a.overview.description} />
      <div className="mb-6">
        <AdminOperationsSummary
          locale={locale}
          prefix={prefix}
          copy={opsCopy}
          extraMetrics={[
            { label: opsCopy.queues.customerActions, value: stats.projectsNeedingCustomerAction, href: `${prefix}/admin/projects` },
          ]}
        />
      </div>

      <SectionCard title={a.overview.recentActivity}>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{a.overview.noActivity}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {stats.recentActivity.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-0.5 border-b pb-3 last:border-0">
                <span className="font-medium">
                  {localizeStoredActivity(activity.summary, activity.eventType, dict.dashboard.activityLabels)}
                </span>
                <span className="text-muted-foreground">
                  {activity.project.name} · {activity.createdAt.toISOString().slice(0, 10)}
                  {activity.actor?.email ? ` · ${activity.actor.email}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-6 text-sm text-muted-foreground">
        {a.overview.quickLinks}{' '}
        <Link href={`${prefix}/admin/customers`} className="text-primary hover:underline">
          {a.nav.customers}
        </Link>
        {' · '}
        <Link href={`${prefix}/admin/projects`} className="text-primary hover:underline">
          {a.nav.projects}
        </Link>
      </p>
    </>
  )
}
