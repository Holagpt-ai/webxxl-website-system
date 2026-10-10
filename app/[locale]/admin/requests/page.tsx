import Link from 'next/link'
import { listChangeRequestQueue } from '@/lib/admin/queries'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { ChangeRequestStatusForm } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'

export default async function AdminChangeRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const requests = await listChangeRequestQueue()
  const prefix = locale === 'es' ? '/es' : ''
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title="Change requests" description="Customer-submitted scope changes." />
      {requests.length === 0 ? (
        <EmptyState title="No change requests" body="Requests from the customer portal will appear here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((cr) => (
            <li key={cr.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                <div>
                  <p className="font-semibold">{cr.title}</p>
                  <p className="text-muted-foreground">
                    {cr.project.customerAccount.businessName} · {cr.priority}
                    {cr.managedSite ? ` · ${cr.managedSite.domain}` : ''}
                  </p>
                  <StatusBadge label={cr.status} />
                  <p className="mt-2 line-clamp-3 text-muted-foreground">{cr.description}</p>
                  <LinkedFileList
                    files={cr.fileLinks.map((link) => link.projectFile)}
                    storageReady={storageReady}
                    downloadLabel="Download"
                  />
                  <Link href={`${prefix}/admin/projects/${cr.projectId}`} className="mt-2 inline-block text-primary hover:underline">
                    Project
                  </Link>
                </div>
                <ChangeRequestStatusForm changeRequestId={cr.id} current={cr.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
