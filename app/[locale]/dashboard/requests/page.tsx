import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { ChangeRequestForm } from '@/components/dashboard/forms'

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

  const requests = await prisma.changeRequest.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <>
      <PageTitle title={d.requestsTitle} />
      <SectionCard title="New request">
        <ChangeRequestForm projectId={project.id} submitLabel={d.submit} priorityLabel={d.priority} />
      </SectionCard>
      <SectionCard title={d.status}>
        <ul className="flex flex-col gap-3 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.title}</p>
                <StatusBadge label={r.status} />
              </div>
              <p className="mt-2 text-muted-foreground">{r.description}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  )
}
