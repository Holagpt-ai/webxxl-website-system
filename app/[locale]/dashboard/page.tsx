import Link from 'next/link'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getDashboardOverview } from '@/lib/portal/queries'
import { PageTitle, SectionCard, EmptyState } from '@/components/dashboard/primitives'
import { WebsitePreviewSection } from '@/components/dashboard/website-preview-section'
import { ProjectDeliverySummary } from '@/components/dashboard/project-delivery-summary'
import { DependencyActionCenter } from '@/components/dashboard/dependency-action-center'
import { ActivityTimeline } from '@/components/dashboard/activity-timeline'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const data = await getDashboardOverview(portal)
  const d = dict.dashboard
  const prefix = locale === 'es' ? '/es' : ''

  if (!data.project || !data.eta) {
    return (
      <>
        <PageTitle title={d.overviewTitle} description={d.overviewDescription} />
        <EmptyState title={d.emptyProject} body={d.emptyProjectBody} />
      </>
    )
  }

  return (
    <>
      <PageTitle
        title={d.overviewTitle}
        description={`${portal.customerAccount.businessName} · ${data.project.name}`}
      />
      <WebsitePreviewSection
        customerAccountId={portal.customerAccount.id}
        projectId={data.project.id}
        projectType={data.project.type}
        locale={locale}
        copy={d}
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.progress}>
          <ProjectDeliverySummary
            projectName={data.project.name}
            projectStatus={data.project.status}
            eta={data.eta}
            locale={locale}
            copy={d}
          />
          <Link href={`${prefix}/dashboard/project`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4 inline-flex')}>
            {d.viewProjectDetails}
          </Link>
        </SectionCard>
        <SectionCard title={d.actionItems}>
          <DependencyActionCenter
            dependencies={data.dependencies}
            localePrefix={prefix}
            locale={locale}
            copy={d}
          />
        </SectionCard>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.awaitingApproval}>
          {data.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <>
              <ul className="mb-3 flex flex-col gap-2 text-sm">
                {data.approvals.map((a) => (
                  <li key={a.id} className="font-medium">
                    {a.title}
                  </li>
                ))}
              </ul>
              <Link href={`${prefix}/dashboard/approvals`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                {d.viewApprovals}
              </Link>
            </>
          )}
        </SectionCard>
        <SectionCard title={d.recentActivity}>
          <ActivityTimeline activities={data.activities} locale={locale} activityLabels={d.activityLabels} emptyLabel={d.activityEmpty} />
        </SectionCard>
      </div>
    </>
  )
}
