import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { CommentForm } from '@/components/dashboard/forms'

export const dynamic = 'force-dynamic'

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  if (!project) {
    return (
      <>
        <PageTitle title={d.messagesTitle} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const comments = await prisma.projectComment.findMany({
    where: { projectId: project.id, visibility: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, email: true } } },
  })

  return (
    <>
      <PageTitle title={d.messagesTitle} />
      <SectionCard title="New message">
        <CommentForm projectId={project.id} submitLabel={d.submit} />
      </SectionCard>
      <SectionCard title={d.recentMessages}>
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border p-3 text-sm">
              <p>{c.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {c.author.name ?? c.author.email} ·{' '}
                {new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(
                  c.createdAt,
                )}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  )
}
