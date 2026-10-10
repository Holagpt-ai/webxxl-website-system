import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'
import { getCustomerVisibleCapabilities } from '@/lib/managed-sites/capabilities'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { isPublicHttpUrl } from '@/lib/managed-sites/domain'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { SiteCapabilityRequestForm } from '@/components/managed-sites/request-form'

export const dynamic = 'force-dynamic'

export default async function ManagedSiteDetailPage({ params }: { params: Promise<{ locale: string; siteId: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const { siteId } = await params
  const portal = await requireCustomerMembership()
  const site = await getManagedSiteForAccount(siteId, portal.customerAccount.id)
  if (!site) notFound()
  const d = dict.dashboard
  const connection = await getManagedSiteAdapter(site.adapterKey).connectionStatus(site)
  const capabilities = getCustomerVisibleCapabilities(site.capabilities)
  const groups = {
    SELF_SERVICE: capabilities.filter((item) => item.executionMode === 'SELF_SERVICE'),
    AI_ASSISTED: capabilities.filter((item) => item.executionMode === 'AI_ASSISTED'),
    HUMAN_REQUIRED: capabilities.filter((item) => item.executionMode === 'HUMAN_REQUIRED'),
    READ_ONLY: capabilities.filter((item) => item.executionMode === 'READ_ONLY'),
  }
  const messages = {
    saved: d.changeSaved,
    unavailable: d.changeUnavailable,
    escalated: d.changeEscalated,
    draft: d.aiDraftSaved,
    projectRequired: d.projectRequired,
    failed: d.changeUnavailable,
  }

  return (
    <>
      <PageTitle title={site.name} description={site.domain} />
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge label={siteStatusLabel(site.status, d)} />
        <StatusBadge label={connection.state === 'manual' ? d.connectionManual : connection.state === 'connected' ? d.connectionConnected : d.connectionNotConnected} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {connection.state === 'connected' ? d.connectionDetailConnected : connection.state === 'manual' ? d.connectionDetailManual : d.connectionDetailNotConnected}
      </p>
      {isPublicHttpUrl(site.canonicalUrl) && (
        <p className="mb-6">
          <a href={site.canonicalUrl} className="text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
            {d.openWebsite}
          </a>
        </p>
      )}
      <div className="grid gap-4">
        <CapabilityGroup title={d.directChanges} items={groups.SELF_SERVICE} locale={locale} siteId={site.id} d={d} messages={messages} allowRequest />
        <CapabilityGroup title={d.aiChanges} items={groups.AI_ASSISTED} locale={locale} siteId={site.id} d={d} messages={messages} allowRequest />
        <CapabilityGroup title={d.humanChanges} items={groups.HUMAN_REQUIRED} locale={locale} siteId={site.id} d={d} messages={messages} allowRequest />
        <CapabilityGroup title={d.viewOnly} items={groups.READ_ONLY} locale={locale} siteId={site.id} d={d} messages={messages} allowRequest={false} />
      </div>
      {site.changes.length > 0 && (
        <div className="mt-6">
          <SectionCard title={d.recentActivity}>
            <ul className="flex flex-col gap-2 text-sm">
              {site.changes.map((change) => (
                <li key={change.id}>
                  {change.capabilityKey} · {change.status}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  )
}

function siteStatusLabel(
  status: string,
  d: { siteStatusActive: string; siteStatusSetup: string; siteStatusDisconnected: string; siteStatusPaused: string },
) {
  const labels = {
    ACTIVE: d.siteStatusActive,
    SETUP: d.siteStatusSetup,
    DISCONNECTED: d.siteStatusDisconnected,
    PAUSED: d.siteStatusPaused,
  }
  return labels[status as keyof typeof labels] ?? status
}

function CapabilityGroup({
  title,
  items,
  locale,
  siteId,
  d,
  messages,
  allowRequest,
}: {
  title: string
  items: { key: string; label: { en: string; es: string }; description: { en: string; es: string }; executionMode: string }[]
  locale: string
  siteId: string
  d: { requestChange: string; siteRequestPlaceholder: string }
  messages: {
    saved: string
    unavailable: string
    escalated: string
    draft: string
    projectRequired: string
    failed: string
  }
  allowRequest: boolean
}) {
  if (items.length === 0) return null
  const language = locale === 'es' ? 'es' : 'en'
  return (
    <SectionCard title={title}>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.key} className="border-b pb-4 last:border-b-0 last:pb-0">
            <p className="font-medium">{item.label[language]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description[language]}</p>
            {allowRequest && (
              <SiteCapabilityRequestForm
                siteId={siteId}
                capabilityKey={item.key}
                submitLabel={d.requestChange}
                placeholder={d.siteRequestPlaceholder}
                messages={messages}
              />
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
