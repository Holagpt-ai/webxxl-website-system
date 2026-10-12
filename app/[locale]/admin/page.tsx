import Link from 'next/link'
import { getAdminDashboardStats } from '@/lib/admin/queries'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizeStoredActivity } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const a = dict.admin
  const stats = await getAdminDashboardStats()
  const prefix = locale === 'es' ? '/es' : ''

  const hasWork =
    stats.activeCustomers +
      stats.activeProjects +
      stats.pendingApprovals +
      stats.openChangeRequests +
      stats.openSupportRequests >
    0

  return (
    <>
      <PageTitle title={a.overview.title} description={a.overview.description} />
      {!hasWork ? (
        <EmptyState title={a.overview.emptyTitle} body={a.overview.emptyBody} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={a.overview.activeCustomers} value={stats.activeCustomers} />
          <Stat label={a.overview.activeProjects} value={stats.activeProjects} />
          <Stat label={a.overview.customerActions} value={stats.projectsNeedingCustomerAction} />
          <Stat label={a.overview.pendingApprovals} value={stats.pendingApprovals} />
          <Stat label={a.overview.openRequests} value={stats.openChangeRequests} />
          <Stat label={a.overview.openSupport} value={stats.openSupportRequests} />
          <Stat label={a.overview.blockedTasks} value={stats.blockedTasks} />
          <Stat label={a.overview.overdueTasks} value={stats.overdueTasks} />
        </div>
      )}

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
