import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { getCustomerInfrastructureOverview } from '@/lib/infrastructure/queries'
import { PageTitle, SectionCard, StatusBadge, EmptyState } from '@/components/dashboard/primitives'
import { LocaleLink } from '@/components/site/primitives'
import { dataSourceCustomerLabel, formatOptionalDate } from '@/lib/infrastructure/display'
import { InfrastructureRequestForm } from '@/components/dashboard/infrastructure-request-form'

export const dynamic = 'force-dynamic'

export default async function InfrastructureDomainsPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!isEnabled('infrastructureManagement')) notFound()
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const loc = locale === 'es' ? 'es' : 'en'
  const prefix = loc === 'es' ? '/es' : ''

  const overview = await getCustomerInfrastructureOverview(portal.customerAccount.id)

  return (
    <>
      <PageTitle title={d.infrastructureDomainsTitle} description={d.infrastructureProviderSyncUnavailable} />
      <LocaleLink locale={loc} href={`${prefix}/dashboard/infrastructure`} className="mb-4 inline-block text-sm text-primary">
        ← {d.infrastructureTitle}
      </LocaleLink>
      {overview.domains.length === 0 ? (
        <EmptyState title={d.infrastructureEmptyDomains} body={d.infrastructureRequestReview} />
      ) : (
        <ul className="mb-8 flex flex-col gap-4">
          {overview.domains.map((domain) => (
            <li key={domain.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{domain.domainName}</p>
                <StatusBadge label={domain.verificationStatus} />
              </div>
              {domain.registrar && <p className="mt-1 text-muted-foreground">{domain.registrar}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {d.infrastructureDataSource}: {dataSourceCustomerLabel(domain.dataSource, loc)}
              </p>
              {domain.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  {d.infrastructureRenewal}: {formatOptionalDate(domain.expiresAt, loc)}
                </p>
              )}
              <div className="mt-4 border-t pt-4">
                <InfrastructureRequestForm
                  locale={loc}
                  requestType="dns_modification"
                  requestTypeLabel={d.infrastructureRequestTypes.dns_modification}
                  messageLabel={d.message}
                  submitLabel={d.submit}
                  assetPublicId={domain.publicId}
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
            requestType="domain_registration"
            requestTypeLabel={d.infrastructureRequestTypes.domain_registration}
            messageLabel={d.message}
            submitLabel={d.submit}
            successMessage={d.infrastructureRequestSubmitted}
            duplicateMessage={d.infrastructureRequestDuplicate}
            reviewNotice={d.infrastructureRequestReview}
          />
          <InfrastructureRequestForm
            locale={loc}
            requestType="domain_transfer"
            requestTypeLabel={d.infrastructureRequestTypes.domain_transfer}
            messageLabel={d.message}
            submitLabel={d.submit}
            successMessage={d.infrastructureRequestSubmitted}
            duplicateMessage={d.infrastructureRequestDuplicate}
            reviewNotice={d.infrastructureRequestReview}
          />
        </div>
      </SectionCard>
    </>
  )
}
