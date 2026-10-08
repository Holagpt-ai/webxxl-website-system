import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { ApprovalActions } from '@/components/dashboard/forms'

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
  })

  return (
    <>
      <PageTitle title={d.approvalsTitle} />
      <div className="flex flex-col gap-4">
        {approvals.map((a) => (
          <SectionCard key={a.id} title={a.title}>
            <p className="mb-3 text-sm text-muted-foreground">{a.description}</p>
            <StatusBadge label={a.status.replace('_', ' ')} />
            {a.status === 'PENDING' && (
              <div className="mt-4">
                <ApprovalActions approvalId={a.id} approveLabel={d.approve} changesLabel={d.requestChanges} />
              </div>
            )}
          </SectionCard>
        ))}
      </div>
    </>
  )
}
