import Link from 'next/link'
import { listProjects } from '@/lib/admin/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const projects = await listProjects()
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title="Projects" description="All customer projects." />
      {projects.length === 0 ? (
        <EmptyState title="No projects" body="Create a project from a customer detail page." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`${prefix}/admin/projects/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.customerAccount.businessName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={p.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.progressPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
