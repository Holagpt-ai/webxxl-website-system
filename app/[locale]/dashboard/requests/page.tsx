import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { ChangeRequestForm } from '@/components/dashboard/forms'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { enumLabel } from '@/lib/i18n/labels'
import { findCustomerWebsitePreview } from '@/lib/website-preview/operations'

export const dynamic = 'force-dynamic'

export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
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

  const preview = await findCustomerWebsitePreview(portal.customerAccount.id, project.id)
  const currentVersion = preview?.versions[0] ?? null

  const [requests, files] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      include: {
        fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } },
        previewVersionRef: { select: { versionLabel: true, deploymentId: true } },
        comments: {
          where: { visibility: 'CUSTOMER' },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.projectFile.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true },
    }),
  ])
  const storageReady = isStorageConfigured()
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <PageTitle title={d.requestsTitle} />
      <SectionCard title={d.newRequest}>
        <ChangeRequestForm
          projectId={project.id}
          submitLabel={d.submit}
          priorityLabel={d.priority}
          categoryLabel={d.revisionCategory}
          attachLabel={d.attachFiles}
          titlePlaceholder={d.titlePlaceholder}
          priorityLabels={d.priorities}
          categoryLabels={d.changeRequestCategories}
          reviewingDeploymentLabel={d.reviewingDeployment}
          websitePreviewVersionId={currentVersion?.id}
          deploymentVersionLabel={currentVersion?.versionLabel}
          successMessage={d.requestSubmitSuccess}
          errorMessage={d.requestSubmitError}
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
                    <StatusBadge label={enumLabel(d.changeRequestStatuses, request.status)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {enumLabel(d.changeRequestCategories, request.category)} · {dateFormat.format(request.createdAt)}
                    {request.previewVersionRef && (
                      <>
                        {' '}
                        · {d.currentVersion} {request.previewVersionRef.versionLabel}
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-muted-foreground">{request.description}</p>
                  {request.comments.length > 0 && (
                    <div className="mt-3 rounded-lg bg-secondary/40 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.staffResponses}</p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {request.comments.map((comment) => (
                          <li key={comment.id} className="text-sm">
                            <p className="whitespace-pre-wrap">{comment.body}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {comment.author.name ?? comment.author.email} · {dateFormat.format(comment.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
