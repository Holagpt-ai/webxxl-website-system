import Link from 'next/link'
import { listProjects } from '@/lib/admin/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const a = dict.admin
  const projects = await listProjects()
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={a.projects.title} description={a.projects.description} />
      {projects.length === 0 ? (
        <EmptyState title={a.projects.emptyTitle} body={a.projects.emptyBody} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{a.project}</th>
                <th className="px-4 py-3">{a.customer}</th>
                <th className="px-4 py-3">{a.status}</th>
                <th className="px-4 py-3">{a.progress}</th>
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
                    <StatusBadge label={enumLabel(dict.dashboard.projectStatuses, p.status)} />
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
