import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getDashboardOverview } from '@/lib/portal/queries'
import { PageTitle, SectionCard, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { DependencyResolveButton } from '@/components/dashboard/forms'

export const dynamic = 'force-dynamic'

function fmtDate(d: Date | null | undefined, locale: string) {
  if (!d) return '—'
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(d)
}

export default async function DashboardOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const data = await getDashboardOverview(portal)
  const d = dict.dashboard

  if (!data.project) {
    return (
      <>
        <PageTitle title={d.overviewTitle} description={d.overviewDescription} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const nextMilestone = data.milestones.find((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS')

  return (
    <>
      <PageTitle
        title={d.overviewTitle}
        description={`${portal.customerAccount.businessName} · ${data.project.name}`}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title={d.progress}>
          <p className="text-3xl font-bold">{data.eta?.progressPercent ?? data.project.progressPercent}%</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {d.phase}: {data.eta?.currentMilestoneTitle ?? '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.eta}: {fmtDate(data.eta?.estimatedCompletionDate, locale)}
          </p>
          {data.eta && <StatusBadge label={data.eta.stateLabel} tone={data.eta.state === 'at_risk' ? 'warn' : 'default'} />}
        </SectionCard>
        <SectionCard title={d.nextMilestone}>
          {nextMilestone ? (
            <>
              <p className="font-medium">{nextMilestone.title}</p>
              <p className="text-sm text-muted-foreground">{fmtDate(nextMilestone.targetDate, locale)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.actionItems}>
          {data.dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.dependencies.map((dep) => (
                <li key={dep.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{dep.title}</p>
                    <p className="text-muted-foreground">{fmtDate(dep.requestedFromCustomerAt, locale)}</p>
                  </div>
                  <DependencyResolveButton dependencyId={dep.id} label={d.resolve} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={d.awaitingApproval}>
          {data.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.approvals.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">{a.title}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title={d.recentActivity}>
          <ul className="flex flex-col gap-2 text-sm">
            {data.activities.map((a) => (
              <li key={a.id}>
                <p>{a.summary}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(a.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title={d.recentMessages}>
          <ul className="flex flex-col gap-2 text-sm">
            {data.comments.map((c) => (
              <li key={c.id}>
                <p className="line-clamp-2">{c.body}</p>
                <p className="text-xs text-muted-foreground">{c.author.name ?? c.author.email}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title={d.recentFiles}>
          <ul className="flex flex-col gap-2 text-sm">
            {data.files.map((f) => (
              <li key={f.id}>{f.originalName}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  )
}
