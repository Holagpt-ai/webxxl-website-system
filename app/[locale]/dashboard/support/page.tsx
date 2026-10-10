import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { SupportForm } from '@/components/dashboard/forms'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  const [tickets, files] = await Promise.all([
    prisma.supportRequest.findMany({
      where: { customerAccountId: portal.customerAccount.id },
      orderBy: { createdAt: 'desc' },
      include: { fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } } },
    }),
    project
      ? prisma.projectFile.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, originalName: true },
        })
      : Promise.resolve([]),
  ])
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title={d.supportTitle} />
      <SectionCard title={d.newRequest}>
        <SupportForm
          projectId={project?.id}
          submitLabel={d.submit}
          subjectLabel={d.subject}
          messageLabel={d.message}
          attachLabel={d.attachFiles}
          files={files}
        />
        {project && files.length === 0 && <p className="mt-3 text-xs text-muted-foreground">{d.noFilesToAttach}</p>}
      </SectionCard>
      <div className="mt-6">
        <SectionCard title={d.status}>
          <ul className="flex flex-col gap-3 text-sm">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{ticket.subject}</p>
                  <StatusBadge label={ticket.status.replace('_', ' ')} />
                </div>
                <p className="mt-2 text-muted-foreground">{ticket.message}</p>
                {ticket.fileLinks.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.supportingFiles}</p>
                    <LinkedFileList
                      files={ticket.fileLinks.map((link) => link.projectFile)}
                      storageReady={storageReady}
                      downloadLabel={d.download}
                    />
                  </>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(ticket.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  )
}
