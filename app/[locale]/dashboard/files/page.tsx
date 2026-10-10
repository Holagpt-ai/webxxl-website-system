import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { FileUploadForm } from '@/components/dashboard/forms'
import { ProjectFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export default async function FilesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
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
    include: { uploadedBy: { select: { name: true, email: true } } },
  })
  const storageReady = isStorageConfigured()
  const categoryLabel = (category: string) => {
    if (category === 'BRAND') return d.categoryBrand
    if (category === 'PHOTO') return d.categoryPhoto
    if (category === 'DOCUMENT') return d.categoryDocument
    return d.categoryOther
  }

  return (
    <>
      <PageTitle title={d.filesTitle} description={d.filesDescription} />
      {!storageReady && (
        <div className="mb-6">
          <EmptyState title={d.storageNotConfigured} body={d.uploadHint} />
        </div>
      )}
      <SectionCard title={d.uploadTitle}>
        <FileUploadForm
          projectId={project.id}
          submitLabel={d.submit}
          categoryLabel={d.category}
          categoryNames={{
            BRAND: d.categoryBrand,
            PHOTO: d.categoryPhoto,
            DOCUMENT: d.categoryDocument,
            OTHER: d.categoryOther,
          }}
          hint={d.uploadHint}
          storageReady={storageReady}
          errors={{
            notConfigured: d.storageNotConfigured,
            tooLarge: d.fileTooLarge,
            invalid: d.fileTypeRejected,
            failed: d.uploadFailed,
          }}
        />
      </SectionCard>
      <div className="mt-6">
        <SectionCard title={d.recentFiles}>
          {files.length === 0 ? (
            <EmptyState title={d.emptyFiles} body={d.emptyFilesBody} />
          ) : (
            <ProjectFileList
              files={files}
              locale={locale}
              storageReady={storageReady}
              downloadLabel={d.download}
              categoryLabel={categoryLabel}
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
