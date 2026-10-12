import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { getCustomerInfrastructureOverview } from '@/lib/infrastructure/queries'
import { PageTitle, SectionCard, StatusBadge, EmptyState } from '@/components/dashboard/primitives'
import { LocaleLink } from '@/components/site/primitives'
import { dataSourceCustomerLabel, formatOptionalDate } from '@/lib/infrastructure/display'
import { InfrastructureRequestForm } from '@/components/dashboard/infrastructure-request-form'
import { enumLabel } from '@/lib/i18n/labels'

export const dynamic = 'force-dynamic'

export default async function InfrastructureEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!isEnabled('infrastructureManagement')) notFound()
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const loc = locale === 'es' ? 'es' : 'en'
  const prefix = loc === 'es' ? '/es' : ''

  const overview = await getCustomerInfrastructureOverview(portal.customerAccount.id)

  return (
    <>
      <PageTitle title={d.infrastructureEmailTitle} description={d.infrastructureProviderSyncUnavailable} />
      <LocaleLink locale={loc} href={`${prefix}/dashboard/infrastructure`} className="mb-4 inline-block text-sm text-primary">
        ← {d.infrastructureTitle}
      </LocaleLink>
      {overview.email.length === 0 ? (
        <EmptyState title={d.infrastructureEmptyEmail} body={d.infrastructureRequestReview} />
      ) : (
        <ul className="mb-8 flex flex-col gap-4">
          {overview.email.map((svc) => (
            <li key={svc.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{svc.planLabel ?? svc.publicId}</p>
                <StatusBadge label={enumLabel(d.emailStatuses, svc.status)} />
              </div>
              {svc.managedDomain && <p className="mt-1 text-muted-foreground">{svc.managedDomain.domainName}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {d.infrastructureMailboxes}: {svc.mailboxCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.infrastructureDataSource}: {dataSourceCustomerLabel(svc.dataSource, loc)}
              </p>
              {svc.renewsAt && (
                <p className="text-xs text-muted-foreground">
                  {d.infrastructureRenewal}: {formatOptionalDate(svc.renewsAt, loc)}
                </p>
              )}
              <div className="mt-4 border-t pt-4">
                <InfrastructureRequestForm
                  locale={loc}
                  requestType="mailbox_addition"
                  requestTypeLabel={d.infrastructureRequestTypes.mailbox_addition}
                  messageLabel={d.message}
                  submitLabel={d.submit}
                  assetPublicId={svc.publicId}
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
        <InfrastructureRequestForm
          locale={loc}
          requestType="email_setup"
          requestTypeLabel={d.infrastructureRequestTypes.email_setup}
          messageLabel={d.message}
          submitLabel={d.submit}
          successMessage={d.infrastructureRequestSubmitted}
          duplicateMessage={d.infrastructureRequestDuplicate}
          reviewNotice={d.infrastructureRequestReview}
        />
      </SectionCard>
    </>
  )
}
