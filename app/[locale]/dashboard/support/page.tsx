import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { SupportForm } from '@/components/dashboard/forms'

export const dynamic = 'force-dynamic'

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  const tickets = await prisma.supportRequest.findMany({
    where: { customerAccountId: portal.customerAccount.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <>
      <PageTitle title={d.supportTitle} />
      <SectionCard title="New request">
        <SupportForm
          projectId={project?.id}
          submitLabel={d.submit}
          subjectLabel={d.subject}
          messageLabel={d.message}
        />
      </SectionCard>
      <SectionCard title={d.status}>
        <ul className="flex flex-col gap-3 text-sm">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{t.subject}</p>
                <StatusBadge label={t.status.replace('_', ' ')} />
              </div>
              <p className="mt-2 text-muted-foreground">{t.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(t.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  )
}
