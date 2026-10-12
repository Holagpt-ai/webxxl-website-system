import { LocaleLink } from '@/components/site/primitives'
import { SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { dataSourceCustomerLabel, formatOptionalDate } from '@/lib/infrastructure/display'
import { enumLabel } from '@/lib/i18n/labels'

type Locale = 'en' | 'es'

type Overview = Awaited<ReturnType<typeof import('@/lib/infrastructure/queries').getCustomerInfrastructureOverview>>

type Dict = {
  dataSourceLabel: string
  renewal: string
  ssl: string
  mailboxes: string
  sectionHosting: string
  sectionDomains: string
  sectionEmail: string
  viewAllHosting: string
  viewAllDomains: string
  viewAllEmail: string
  emptyHosting: string
  emptyDomains: string
  emptyEmail: string
  hostingStatuses: { [key: string]: string }
  sslStatuses: { [key: string]: string }
  domainVerificationStatuses: { [key: string]: string }
  emailStatuses: { [key: string]: string }
}

export function InfrastructureOverviewCards({
  locale,
  overview,
  dict,
}: {
  locale: Locale
  overview: Overview
  dict: Dict
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title={dict.sectionHosting}>
        {overview.hosting.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.emptyHosting}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {overview.hosting.slice(0, 3).map((h) => (
              <li key={h.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.planLabel ?? h.publicId}</span>
                  <StatusBadge label={enumLabel(dict.hostingStatuses, h.status)} />
                </div>
                {h.primaryDomain && <p className="mt-1 text-muted-foreground">{h.primaryDomain}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {dict.dataSourceLabel}: {dataSourceCustomerLabel(h.dataSource, locale)}
                </p>
                {h.renewsAt && (
                  <p className="text-xs text-muted-foreground">
                    {dict.renewal}: {formatOptionalDate(h.renewsAt, locale)}
                  </p>
                )}
                {h.sslStatus !== 'UNKNOWN' && (
                  <p className="text-xs text-muted-foreground">
                    {dict.ssl}: {enumLabel(dict.sslStatuses, h.sslStatus)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <LocaleLink locale={locale} href="/dashboard/infrastructure/hosting" className="mt-3 inline-block text-sm text-primary">
          {dict.viewAllHosting}
        </LocaleLink>
      </SectionCard>

      <SectionCard title={dict.sectionDomains}>
        {overview.domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.emptyDomains}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {overview.domains.slice(0, 3).map((d) => (
              <li key={d.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{d.domainName}</span>
                  <StatusBadge label={enumLabel(dict.domainVerificationStatuses, d.verificationStatus)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {dict.dataSourceLabel}: {dataSourceCustomerLabel(d.dataSource, locale)}
                </p>
                {d.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    {dict.renewal}: {formatOptionalDate(d.expiresAt, locale)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <LocaleLink locale={locale} href="/dashboard/infrastructure/domains" className="mt-3 inline-block text-sm text-primary">
          {dict.viewAllDomains}
        </LocaleLink>
      </SectionCard>

      <SectionCard title={dict.sectionEmail}>
        {overview.email.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.emptyEmail}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {overview.email.slice(0, 3).map((e) => (
              <li key={e.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.planLabel ?? e.publicId}</span>
                  <StatusBadge label={enumLabel(dict.emailStatuses, e.status)} />
                </div>
                {e.managedDomain && <p className="mt-1 text-muted-foreground">{e.managedDomain.domainName}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {dict.mailboxes}: {e.mailboxCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dict.dataSourceLabel}: {dataSourceCustomerLabel(e.dataSource, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <LocaleLink locale={locale} href="/dashboard/infrastructure/email" className="mt-3 inline-block text-sm text-primary">
          {dict.viewAllEmail}
        </LocaleLink>
      </SectionCard>
    </div>
  )
}
