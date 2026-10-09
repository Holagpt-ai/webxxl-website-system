import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { FileUploadForm } from '@/components/dashboard/forms'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export default async function FilesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  if (!project) {
    return (
      <>
        <PageTitle title={d.filesTitle} description={d.filesDescription} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const files = await prisma.projectFile.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <>
      <PageTitle title={d.filesTitle} description={d.filesDescription} />
      <SectionCard title="Upload">
        {!isStorageConfigured() && <p className="mb-3 text-sm text-muted-foreground">{d.storageNotConfigured}</p>}
        <FileUploadForm projectId={project.id} submitLabel={d.submit} notConfiguredMessage={d.storageNotConfigured} />
      </SectionCard>
      <SectionCard title={d.recentFiles}>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex justify-between gap-4 border-b pb-2">
                <span>{f.originalName}</span>
                <span className="text-muted-foreground">{f.mimeType}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  )
}
