import Link from 'next/link'
import { listChangeRequestQueue } from '@/lib/admin/queries'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'
import { ChangeRequestStatusForm } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'

export default async function AdminChangeRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const copy = dict.admin
  const requests = await listChangeRequestQueue()
  const prefix = locale === 'es' ? '/es' : ''
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title={copy.requests.title} description={copy.requests.description} />
      {requests.length === 0 ? (
        <EmptyState title={copy.requests.emptyTitle} body={copy.requests.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((cr) => (
            <li key={cr.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                <div>
                  <p className="font-semibold">{cr.title}</p>
                  <p className="text-muted-foreground">
                    {cr.project.customerAccount.businessName} · {enumLabel(dict.dashboard.priorities, cr.priority)}
                    {cr.managedSite ? ` · ${cr.managedSite.domain}` : ''}
                  </p>
                  <StatusBadge label={enumLabel(dict.dashboard.changeRequestStatuses, cr.status)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {enumLabel(dict.dashboard.changeRequestCategories, cr.category)}
                    {cr.previewVersionRef
                      ? ` · ${dict.dashboard.currentVersion} ${cr.previewVersionRef.versionLabel} (${cr.previewVersionRef.deploymentId})`
                      : ''}
                  </p>
                  <p className="mt-2 line-clamp-3 text-muted-foreground">{cr.description}</p>
                  <LinkedFileList
                    files={cr.fileLinks.map((link) => link.projectFile)}
                    storageReady={storageReady}
                    downloadLabel={copy.download}
                  />
                  <Link href={`${prefix}/admin/projects/${cr.projectId}`} className="mt-2 inline-block text-primary hover:underline">
                    {copy.project}
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
