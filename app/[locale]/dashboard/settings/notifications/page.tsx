import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isEnabled } from '@/config/features'
import { PageTitle, SectionCard } from '@/components/dashboard/primitives'
import { getCustomerNotificationPreference } from '@/lib/automation/preferences'
import { NotificationPreferencesForm } from '@/components/dashboard/notification-preferences-form'

export const dynamic = 'force-dynamic'

export default async function NotificationSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  if (!isEnabled('automationNotifications')) notFound()
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const prefs = await getCustomerNotificationPreference(portal.id, portal.customerAccount.id)

  return (
    <>
      <PageTitle title={d.notificationSettingsTitle} description={d.notificationSettingsDescription} />
      <SectionCard title={d.notificationSettingsTitle}>
        <NotificationPreferencesForm
          initial={{
            projectUpdates: prefs.projectUpdates,
            messagesAndApprovals: prefs.messagesAndApprovals,
            serviceOrders: prefs.serviceOrders,
            infrastructureRenewals: prefs.infrastructureRenewals,
            transactionalEmail: prefs.transactionalEmail,
          }}
          labels={{
            projectUpdates: d.notificationPrefProjectUpdates,
            messagesAndApprovals: d.notificationPrefMessagesApprovals,
            serviceOrders: d.notificationPrefServiceOrders,
            infrastructureRenewals: d.notificationPrefInfrastructureRenewals,
            transactionalEmail: d.notificationPrefTransactionalEmail,
            save: d.submit,
            saved: d.notificationPreferencesSaved,
            essentialNote: d.notificationEssentialNote,
          }}
        />
      </SectionCard>
    </>
  )
}
