import Link from 'next/link'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { getProjectDetail } from '@/lib/portal/queries'
import { PageTitle, SectionCard } from '@/components/dashboard/primitives'
import { EmptyState } from '@/components/dashboard/primitives'
import { WebsitePreviewSection } from '@/components/dashboard/website-preview-section'
import { CollaborationLinks } from '@/components/dashboard/collaboration-links'
import { ProjectDeliverySummary } from '@/components/dashboard/project-delivery-summary'
import { MilestoneRoadmap } from '@/components/dashboard/milestone-roadmap'
import { DependencyActionCenter } from '@/components/dashboard/dependency-action-center'
import { ActivityTimeline } from '@/components/dashboard/activity-timeline'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const active = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard
  const prefix = locale === 'es' ? '/es' : ''

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
      <WebsitePreviewSection
        customerAccountId={portal.customerAccount.id}
        projectId={project.id}
        projectType={project.type}
        locale={locale}
        copy={d}
      />
      <div className="mb-6">
        <CollaborationLinks localePrefix={prefix} copy={d} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.progress}>
          <ProjectDeliverySummary
            projectName={project.name}
            projectStatus={project.status}
            eta={eta}
            locale={locale}
            copy={d}
          />
        </SectionCard>
        <SectionCard title={d.actionItems}>
          <DependencyActionCenter
            dependencies={dependencies}
            localePrefix={prefix}
            locale={locale}
            copy={d}
          />
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard title={d.milestonesHeading}>
          <MilestoneRoadmap milestones={milestones} tasks={tasks} locale={locale} copy={d} />
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard title={d.recentActivity}>
          <ActivityTimeline activities={activities} locale={locale} activityLabels={d.activityLabels} emptyLabel={d.activityEmpty} />
        </SectionCard>
      </div>
    </>
  )
}
