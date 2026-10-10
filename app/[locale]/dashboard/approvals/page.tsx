import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { ApprovalActions } from '@/components/dashboard/forms'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  if (!project) {
    return (
      <>
        <PageTitle title={d.approvalsTitle} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const approvals = await prisma.projectApproval.findMany({
    where: { projectId: project.id },
    orderBy: { requestedAt: 'desc' },
    include: { fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } } },
  })
  const storageReady = isStorageConfigured()

  return (
    <>
      <PageTitle title={d.approvalsTitle} />
      {approvals.length === 0 ? (
        <EmptyState title={d.emptyApprovals} body={d.emptyApprovalsBody} />
      ) : (
        <div className="flex flex-col gap-4">
          {approvals.map((approval) => (
            <SectionCard key={approval.id} title={approval.title}>
              <p className="mb-3 text-sm text-muted-foreground">{approval.description}</p>
              <StatusBadge label={approval.status.replace('_', ' ')} />
              {approval.fileLinks.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium">{d.supportingFiles}</p>
                  <LinkedFileList
                    files={approval.fileLinks.map((link) => link.projectFile)}
                    storageReady={storageReady}
                    downloadLabel={d.download}
                  />
                  {!storageReady && <p className="mt-2 text-xs text-muted-foreground">{d.storageNotConfigured}</p>}
                </div>
              )}
              {approval.status === 'PENDING' && (
                <div className="mt-4">
                  <ApprovalActions approvalId={approval.id} approveLabel={d.approve} changesLabel={d.requestChanges} />
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </>
  )
}
