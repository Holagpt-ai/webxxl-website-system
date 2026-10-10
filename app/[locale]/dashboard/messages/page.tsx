import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { CommentForm } from '@/components/dashboard/forms'
import { filterCustomerComments } from '@/lib/portal/access-rules'

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

  const comments = filterCustomerComments(
    await prisma.projectComment.findMany({
      where: { projectId: project.id, visibility: 'CUSTOMER' },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true, email: true } } },
    }),
  )
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <PageTitle title={d.messagesTitle} />
      <SectionCard title={d.recentMessages}>
        {comments.length === 0 ? (
          <EmptyState title={d.emptyMessages} body={d.emptyMessagesBody} />
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-lg border p-3 text-sm">
                <p className="whitespace-pre-wrap">{comment.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {comment.author.name ?? comment.author.email} · {dateFormat.format(comment.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <div className="mt-6">
        <SectionCard title={d.newMessage}>
          <CommentForm projectId={project.id} submitLabel={d.submit} />
        </SectionCard>
      </div>
    </>
  )
}
