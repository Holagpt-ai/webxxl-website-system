import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { getCustomerInfrastructureOverview, listCustomerProjectsForInfrastructure } from '@/lib/infrastructure/queries'
import { PageTitle, SectionCard } from '@/components/dashboard/primitives'
import { LocaleLink } from '@/components/site/primitives'
import { InfrastructureOverviewCards } from '@/components/dashboard/infrastructure-summary'
import { InfrastructureRequestForm } from '@/components/dashboard/infrastructure-request-form'

export const dynamic = 'force-dynamic'

export default async function InfrastructureOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!isEnabled('infrastructureManagement')) notFound()
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const loc = locale === 'es' ? 'es' : 'en'
  const prefix = loc === 'es' ? '/es' : ''

  const [overview, projects] = await Promise.all([
    getCustomerInfrastructureOverview(portal.customerAccount.id),
    listCustomerProjectsForInfrastructure(portal.customerAccount.id),
  ])

  const infraDict = {
    dataSourceLabel: d.infrastructureDataSource,
    renewal: d.infrastructureRenewal,
    ssl: d.infrastructureSsl,
    mailboxes: d.infrastructureMailboxes,
    sectionHosting: d.infrastructureSectionHosting,
    sectionDomains: d.infrastructureSectionDomains,
    sectionEmail: d.infrastructureSectionEmail,
    viewAllHosting: d.infrastructureViewHosting,
    viewAllDomains: d.infrastructureViewDomains,
    viewAllEmail: d.infrastructureViewEmail,
    emptyHosting: d.infrastructureEmptyHosting,
    emptyDomains: d.infrastructureEmptyDomains,
    emptyEmail: d.infrastructureEmptyEmail,
  }

  return (
    <>
      <PageTitle title={d.infrastructureTitle} description={d.infrastructureDescription} />
      <p className="mb-6 text-sm text-muted-foreground">{d.infrastructureProviderSyncUnavailable}</p>
      <InfrastructureOverviewCards locale={loc} overview={overview} dict={infraDict} prefix={prefix} />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title={d.infrastructureRequestTitle}>
          <InfrastructureRequestForm
            locale={loc}
            requestType="renewal_assistance"
            requestTypeLabel={d.infrastructureRequestTypes.renewal_assistance}
            messageLabel={d.message}
            submitLabel={d.submit}
            successMessage={d.infrastructureRequestSubmitted}
            duplicateMessage={d.infrastructureRequestDuplicate}
            reviewNotice={d.infrastructureRequestReview}
            projects={projects}
            selectProjectLabel={d.marketplaceSelectProject}
          />
        </SectionCard>
        <SectionCard title={d.servicesTitle}>
          <p className="text-sm text-muted-foreground">{d.infrastructureMarketplaceLink}</p>
          <LocaleLink locale={loc} href={`${prefix}/dashboard/services`} className="mt-3 inline-block text-sm text-primary">
            {d.nav.services} →
          </LocaleLink>
        </SectionCard>
      </div>
    </>
  )
}
