import Link from 'next/link'
import { listPendingApprovals } from '@/lib/admin/queries'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const a = dict.admin
  const approvals = await listPendingApprovals()
  const prefix = locale === 'es' ? '/es' : ''
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title={a.approvals.title} description={a.approvals.description} />
      {approvals.length === 0 ? (
        <EmptyState title={a.approvals.emptyTitle} body={a.approvals.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-4">
          {approvals.map((item) => (
            <li key={item.id} className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted-foreground">
                {item.project.customerAccount.businessName} · {item.project.name}
              </p>
              <StatusBadge label={enumLabel(dict.dashboard.approvalStatuses, item.status)} />
              <LinkedFileList
                files={item.fileLinks.map((link) => link.projectFile)}
                storageReady={storageReady}
                downloadLabel={a.download}
              />
              <p className="mt-2">
                <Link href={`${prefix}/admin/projects/${item.projectId}`} className="text-primary hover:underline">
                  {a.projects.manageProject}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
