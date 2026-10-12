import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { getCustomerInfrastructureOverview, listCustomerProjectsForInfrastructure } from '@/lib/infrastructure/queries'
import { PageTitle, SectionCard, StatusBadge, EmptyState } from '@/components/dashboard/primitives'
import { LocaleLink } from '@/components/site/primitives'
import { dataSourceCustomerLabel, formatOptionalDate } from '@/lib/infrastructure/display'
import { InfrastructureRequestForm } from '@/components/dashboard/infrastructure-request-form'
import { enumLabel } from '@/lib/i18n/labels'

export const dynamic = 'force-dynamic'

export default async function InfrastructureHostingPage({ params }: { params: Promise<{ locale: string }> }) {
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

  return (
    <>
      <PageTitle title={d.infrastructureHostingTitle} description={d.infrastructureProviderSyncUnavailable} />
      <LocaleLink locale={loc} href={`${prefix}/dashboard/infrastructure`} className="mb-4 inline-block text-sm text-primary">
        ← {d.infrastructureTitle}
      </LocaleLink>
      {overview.hosting.length === 0 ? (
        <EmptyState title={d.infrastructureEmptyHosting} body={d.infrastructureRequestReview} />
      ) : (
        <ul className="mb-8 flex flex-col gap-4">
          {overview.hosting.map((h) => (
            <li key={h.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{h.planLabel ?? h.publicId}</p>
                <StatusBadge label={enumLabel(d.hostingStatuses, h.status)} />
              </div>
              <p className="mt-1 text-muted-foreground">{h.primaryDomain ?? h.providerId}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {d.infrastructureDataSource}: {dataSourceCustomerLabel(h.dataSource, loc)}
              </p>
              {h.renewsAt && (
                <p className="text-xs text-muted-foreground">
                  {d.infrastructureRenewal}: {formatOptionalDate(h.renewsAt, loc)}
                </p>
              )}
              {h.sslStatus !== 'UNKNOWN' && (
                <p className="text-xs text-muted-foreground">
                  {d.infrastructureSsl}: {enumLabel(d.sslStatuses, h.sslStatus)}
                </p>
              )}
              {h.project && (
                <p className="mt-2 text-xs">
                  {d.siteLinkedProject}:{' '}
                  <LocaleLink locale={loc} href={`${prefix}/dashboard/project`} className="text-primary">
                    {h.project.name}
                  </LocaleLink>
                </p>
              )}
              <div className="mt-4 border-t pt-4">
                <InfrastructureRequestForm
                  locale={loc}
                  requestType="ssl_assistance"
                  requestTypeLabel={d.infrastructureRequestTypes.ssl_assistance}
                  messageLabel={d.message}
                  submitLabel={d.submit}
                  assetPublicId={h.publicId}
                  projectId={h.projectId ?? undefined}
                  successMessage={d.infrastructureRequestSubmitted}
                  duplicateMessage={d.infrastructureRequestDuplicate}
                  reviewNotice={d.infrastructureRequestReview}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <SectionCard title={d.infrastructureRequestTitle}>
        <div className="grid gap-6 md:grid-cols-2">
          <InfrastructureRequestForm
            locale={loc}
            requestType="hosting_setup"
            requestTypeLabel={d.infrastructureRequestTypes.hosting_setup}
            messageLabel={d.message}
            submitLabel={d.submit}
            successMessage={d.infrastructureRequestSubmitted}
            duplicateMessage={d.infrastructureRequestDuplicate}
            reviewNotice={d.infrastructureRequestReview}
            projects={projects}
            selectProjectLabel={d.marketplaceSelectProject}
          />
          <InfrastructureRequestForm
            locale={loc}
            requestType="hosting_migration"
            requestTypeLabel={d.infrastructureRequestTypes.hosting_migration}
            messageLabel={d.message}
            submitLabel={d.submit}
            successMessage={d.infrastructureRequestSubmitted}
            duplicateMessage={d.infrastructureRequestDuplicate}
            reviewNotice={d.infrastructureRequestReview}
            projects={projects}
            selectProjectLabel={d.marketplaceSelectProject}
          />
        </div>
      </SectionCard>
    </>
  )
}
