import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { getProjectDetail } from '@/lib/portal/queries'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { DependencyResolveButton } from '@/components/dashboard/forms'
import { EmptyState } from '@/components/dashboard/primitives'

export const dynamic = 'force-dynamic'

function fmtDate(d: Date | null | undefined, locale: string) {
  if (!d) return '—'
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(d)
}

export default async function ProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const active = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard

  if (!active) {
    return (
      <>
        <PageTitle title={d.projectTitle} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  const detail = await getProjectDetail(portal, active.id)
  if (!detail) {
    return <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
  }

  const { project, milestones, tasks, dependencies, activities, eta } = detail

  return (
    <>
      <PageTitle title={project.name} description={project.summary ?? undefined} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge label={project.status.replace('_', ' ')} />
        <StatusBadge label={`${eta.progressPercent}%`} />
        {eta && <StatusBadge label={eta.stateLabel} tone={eta.state === 'at_risk' ? 'warn' : 'default'} />}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.progress}>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Start</dt>
              <dd>{fmtDate(project.startDate, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Target</dt>
              <dd>{fmtDate(project.targetDate, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{d.eta}</dt>
              <dd>{fmtDate(eta.estimatedCompletionDate, locale)}</dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard title={d.actionItems}>
          <ul className="flex flex-col gap-3 text-sm">
            {dependencies
              .filter((dep) => dep.status === 'REQUESTED' || dep.status === 'IN_PROGRESS')
              .map((dep) => (
                <li key={dep.id} className="flex justify-between gap-3">
                  <span>{dep.title}</span>
                  <DependencyResolveButton dependencyId={dep.id} label={d.resolve} />
                </li>
              ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Milestones">
          <ol className="flex flex-col gap-3">
            {milestones.map((m) => (
              <li key={m.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{m.title}</p>
                <p className="text-muted-foreground">{m.status.replace('_', ' ')}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard title="Tasks">
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">WebXXL</p>
              <ul className="flex flex-col gap-1 text-sm">
                {tasks.filter((t) => t.assignedSide === 'WEBXXL').map((t) => (
                  <li key={t.id}>{t.title} — {t.status}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Customer</p>
              <ul className="flex flex-col gap-1 text-sm">
                {tasks.filter((t) => t.assignedSide === 'CUSTOMER').map((t) => (
                  <li key={t.id}>{t.title} — {t.status}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title={d.recentActivity}>
          <ul className="flex flex-col gap-2 text-sm">
            {activities.map((a) => (
              <li key={a.id}>
                <p>{a.summary}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(a.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  )
}
