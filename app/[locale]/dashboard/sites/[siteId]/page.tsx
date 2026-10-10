import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'
import { getCustomerVisibleCapabilities } from '@/lib/managed-sites/capabilities'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { isPublicHttpUrl } from '@/lib/managed-sites/domain'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { SiteCapabilityRequestForm } from '@/components/managed-sites/request-form'
import { SiteCampaignPanel } from '@/components/managed-sites/site-campaign-panel'
import { listAbmedCampaignSummariesForSite } from '@/lib/managed-sites/abmed/queries'

export const dynamic = 'force-dynamic'

export default async function ManagedSiteDetailPage({ params }: { params: Promise<{ locale: string; siteId: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const { siteId } = await params
  const portal = await requireCustomerMembership()
  const site = await getManagedSiteForAccount(siteId, portal.customerAccount.id)
  if (!site) notFound()
  const d = dict.dashboard
  const connection = await getManagedSiteAdapter(site.adapterKey).connectionStatus(site)
  const remoteCampaigns =
    site.adapterKey === 'abmed' ? await listAbmedCampaignSummariesForSite(site) : { ok: false as const, campaigns: [] }
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
      {(site.capabilities.some((item) => item.enabled && ['campaigns.view', 'popups.view'].includes(item.capabilityKey)) ||
        remoteCampaigns.ok) && (
        <SectionCard title={d.abmedCampaignsTitle}>
          {!remoteCampaigns.ok ? (
            <p className="text-sm text-muted-foreground">{d.abmedCampaignsUnavailable}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {remoteCampaigns.campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-md border p-3">
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-muted-foreground">
                    {campaign.status} · {campaign.derivedState} · v{campaign.currentVersion} · {campaign.site}
                  </p>
                  <p className="mt-1">{campaign.headline}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.startAt ?? '—'} → {campaign.endAt ?? '—'} · {campaign.updatedAt}
                  </p>
                </li>
              ))}
              {remoteCampaigns.campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">{d.abmedCampaignsEmpty}</p>
              )}
            </ul>
          )}
        </SectionCard>
      )}
      <div className="grid gap-4">
        <CapabilityGroup
          title={d.directChanges}
          items={groups.SELF_SERVICE}
          locale={locale}
          siteId={site.id}
          d={d}
          messages={messages}
          allowRequest
          connected={connection.state === 'connected'}
          campaigns={remoteCampaigns.campaigns}
        />
        <CapabilityGroup
          title={d.aiChanges}
          items={groups.AI_ASSISTED}
          locale={locale}
          siteId={site.id}
          d={d}
          messages={messages}
          allowRequest
          connected={connection.state === 'connected'}
          campaigns={remoteCampaigns.campaigns}
        />
        <CapabilityGroup
          title={d.humanChanges}
          items={groups.HUMAN_REQUIRED}
          locale={locale}
          siteId={site.id}
          d={d}
          messages={messages}
          allowRequest
          connected={connection.state === 'connected'}
          campaigns={remoteCampaigns.campaigns}
        />
        <CapabilityGroup
          title={d.viewOnly}
          items={groups.READ_ONLY}
          locale={locale}
          siteId={site.id}
          d={d}
          messages={messages}
          allowRequest={false}
          connected={connection.state === 'connected'}
          campaigns={remoteCampaigns.campaigns}
        />
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
  connected,
  campaigns,
}: {
  title: string
  items: { key: string; label: { en: string; es: string }; description: { en: string; es: string }; executionMode: string }[]
  locale: string
  siteId: string
  d: {
    requestChange: string
    siteRequestPlaceholder: string
    abmedCampaignsTitle: string
    abmedCampaignsEmpty: string
    abmedCampaignsUnavailable: string
    abmedCampaignDraftTitle: string
    abmedCampaignDraftHint: string
    abmedCampaignCreateDraft: string
    abmedCampaignEditDraft: string
    abmedCampaignDraftSaved: string
    abmedCampaignVersionConflict: string
    abmedCampaignFieldName: string
    abmedCampaignFieldSlug: string
    abmedCampaignFieldHeadline: string
    abmedCampaignFieldBody: string
    abmedCampaignFieldCtaText: string
    abmedCampaignFieldCtaDestination: string
    abmedCampaignFieldStartAt: string
    abmedCampaignFieldEndAt: string
    abmedCampaignFieldDelayMs: string
    abmedCampaignFieldFrequencyDays: string
    abmedCampaignFieldDeviceTargeting: string
  }
  messages: {
    saved: string
    unavailable: string
    escalated: string
    draft: string
    projectRequired: string
    failed: string
  }
  allowRequest: boolean
  connected: boolean
  campaigns: import('@/lib/managed-sites/abmed/control-client').AbmedRemoteCampaign[]
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
            {allowRequest && (item.key === 'popups.manage' || item.key === 'campaigns.manage') ? (
              <SiteCampaignPanel
                siteId={siteId}
                capabilityKey={item.key as 'popups.manage' | 'campaigns.manage'}
                campaigns={campaigns}
                connected={connected}
                dict={d}
              />
            ) : (
              allowRequest && (
                <SiteCapabilityRequestForm
                  siteId={siteId}
                  capabilityKey={item.key}
                  submitLabel={d.requestChange}
                  placeholder={d.siteRequestPlaceholder}
                  messages={messages}
                />
              )
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
