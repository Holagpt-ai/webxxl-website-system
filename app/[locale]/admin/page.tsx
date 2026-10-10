import Link from 'next/link'
import { getAdminDashboardStats } from '@/lib/admin/queries'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
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
      <PageTitle title="Operations overview" description="Live counts from production data." />
      {!hasWork ? (
        <EmptyState title="No operational data yet" body="Customer accounts and projects will appear here once they exist in the database." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active customers" value={stats.activeCustomers} />
          <Stat label="Active projects" value={stats.activeProjects} />
          <Stat label="Customer actions open" value={stats.projectsNeedingCustomerAction} />
          <Stat label="Pending approvals" value={stats.pendingApprovals} />
          <Stat label="Open change requests" value={stats.openChangeRequests} />
          <Stat label="Open support tickets" value={stats.openSupportRequests} />
          <Stat label="Blocked tasks" value={stats.blockedTasks} />
          <Stat label="Overdue tasks" value={stats.overdueTasks} />
        </div>
      )}

      <SectionCard title="Recent activity">
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {stats.recentActivity.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 border-b pb-3 last:border-0">
                <span className="font-medium">{a.summary}</span>
                <span className="text-muted-foreground">
                  {a.project.name} · {a.createdAt.toISOString().slice(0, 10)}
                  {a.actor?.email ? ` · ${a.actor.email}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-6 text-sm text-muted-foreground">
        Quick links:{' '}
        <Link href={`${prefix}/admin/customers`} className="text-primary hover:underline">
          Customers
        </Link>
        {' · '}
        <Link href={`${prefix}/admin/projects`} className="text-primary hover:underline">
          Projects
        </Link>
      </p>
    </>
  )
}
