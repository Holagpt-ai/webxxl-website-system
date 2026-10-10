import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { ChangeRequestForm } from '@/components/dashboard/forms'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  if (!project) {
    return (
      <>
        <PageTitle title={d.requestsTitle} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const [requests, files] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      include: { fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } } },
    }),
    prisma.projectFile.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true },
    }),
  ])
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title={d.requestsTitle} />
      <SectionCard title={d.newRequest}>
        <ChangeRequestForm
          projectId={project.id}
          submitLabel={d.submit}
          priorityLabel={d.priority}
          attachLabel={d.attachFiles}
          files={files}
        />
        {files.length === 0 && <p className="mt-3 text-xs text-muted-foreground">{d.noFilesToAttach}</p>}
      </SectionCard>
      <div className="mt-6">
        <SectionCard title={d.status}>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {requests.map((request) => (
                <li key={request.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{request.title}</p>
                    <StatusBadge label={request.status} />
                  </div>
                  <p className="mt-2 text-muted-foreground">{request.description}</p>
                  {request.fileLinks.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.supportingFiles}</p>
                      <LinkedFileList
                        files={request.fileLinks.map((link) => link.projectFile)}
                        storageReady={storageReady}
                        downloadLabel={d.download}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  )
}
