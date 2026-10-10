import Link from 'next/link'
import { listPendingApprovals } from '@/lib/admin/queries'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AdminApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const approvals = await listPendingApprovals()
  const prefix = locale === 'es' ? '/es' : ''
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title="Pending approvals" description="Awaiting customer response." />
      {approvals.length === 0 ? (
        <EmptyState title="No pending approvals" body="Create approval requests from a project detail page." />
      ) : (
        <ul className="flex flex-col gap-4">
          {approvals.map((a) => (
            <li key={a.id} className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-semibold">{a.title}</p>
              <p className="text-muted-foreground">
                {a.project.customerAccount.businessName} · {a.project.name}
              </p>
              <StatusBadge label={a.status} />
              <LinkedFileList
                files={a.fileLinks.map((link) => link.projectFile)}
                storageReady={storageReady}
                downloadLabel="Download"
              />
              <p className="mt-2">
                <Link href={`${prefix}/admin/projects/${a.projectId}`} className="text-primary hover:underline">
                  Manage project
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
