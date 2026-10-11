import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { PageTitle, EmptyState, SectionCard } from '@/components/dashboard/primitives'
import { listCustomerNotifications, getDeliveryStatusForNotifications } from '@/lib/automation/queries'
import { NotificationList } from '@/components/dashboard/notification-list'
import { LocaleLink } from '@/components/site/primitives'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!isEnabled('automationNotifications')) notFound()
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const loc = locale === 'es' ? 'es' : 'en'
  const prefix = loc === 'es' ? '/es' : ''

  const rows = await listCustomerNotifications(portal.id, portal.customerAccount.id)
  const delivery = await getDeliveryStatusForNotifications(
    portal.id,
    rows.map((r) => r.id),
  )
  const deliveryByNotification = new Map(delivery.map((j) => [j.providerRef, j.status]))

  const items = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    actionUrl: n.actionUrl,
    readAt: n.readAt,
    createdAt: n.createdAt,
    deliveryStatus: deliveryByNotification.get(n.id) ?? (n.readAt ? 'DELIVERED' : null),
  }))

  return (
    <>
      <PageTitle title={d.notificationsTitle} description={d.notificationsDescription} />
      <LocaleLink locale={loc} href={`${prefix}/dashboard/settings/notifications`} className="mb-4 inline-block text-sm text-primary">
        {d.notificationSettingsLink}
      </LocaleLink>
      {items.length === 0 ? (
        <EmptyState title={d.notificationsEmptyTitle} body={d.notificationsEmptyBody} />
      ) : (
        <SectionCard title={d.notificationsTitle}>
          <NotificationList
            locale={loc}
            items={items}
            markReadLabel={d.notificationMarkRead}
            markAllReadLabel={d.notificationMarkAllRead}
            deliveryLabel={d.notificationDeliveryStatus}
            unreadLabel={d.notificationUnread}
          />
        </SectionCard>
      )}
    </>
  )
}
