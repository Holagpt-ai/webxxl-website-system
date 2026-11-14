import { LocaleLink } from '@/components/site/primitives'
import { SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { enumLabel } from '@/lib/i18n/labels'
import type { listCustomerInfrastructureActivity, listCustomerInfrastructureSupportRequests } from '@/lib/infrastructure/queries'

type ActivityRow = Awaited<ReturnType<typeof listCustomerInfrastructureActivity>>[number]
type TicketRow = Awaited<ReturnType<typeof listCustomerInfrastructureSupportRequests>>[number]

export function InfrastructureActivityPanel({
  locale,
  items,
  title,
  empty,
}: {
  locale: 'en' | 'es'
  items: ActivityRow[]
  title: string
  empty: string
}) {
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((row) => (
            <li key={row.id} className="rounded-md border px-3 py-2">
              <p className="font-medium">{row.summary}</p>
              <p className="text-xs text-muted-foreground">
                {row.assetType} · {fmt.format(row.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function InfrastructureRequestsPanel({
  locale,
  items,
  title,
  empty,
  viewSupportLabel,
  supportStatuses,
}: {
  locale: 'en' | 'es'
  items: TicketRow[]
  title: string
  empty: string
  viewSupportLabel: string
  supportStatuses: Record<string, string>
}) {
  const prefix = locale === 'es' ? '/es' : ''
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' })
  return (
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((t) => (
            <li key={t.id} id={`infra-support-ref-${t.id}`} className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{t.subject}</p>
                <StatusBadge label={enumLabel(supportStatuses, t.status)} />
              </div>
              <p className="text-xs text-muted-foreground">{fmt.format(t.updatedAt)}</p>
              <LocaleLink
                locale={locale}
                href={`${prefix}/dashboard/support?ticketId=${encodeURIComponent(t.id)}`}
                className="mt-2 inline-block text-xs text-primary"
              >
                {viewSupportLabel} →
              </LocaleLink>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}