import { notFound } from 'next/navigation'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'
import { getCustomerVisibleCapabilities } from '@/lib/managed-sites/capabilities'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { isPublicHttpUrl } from '@/lib/managed-sites/domain'
import {
  customerActivityTitle,
  customerChangeStatusLabel,
  filterWebsiteChangeCapabilities,
  resolveUnifiedCampaignSection,
  connectionStateCustomerLabel,
} from '@/lib/managed-sites/customer-presentation'
import { StatusBadge, SectionCard } from '@/components/dashboard/primitives'
import { SiteCampaignPanel } from '@/components/managed-sites/site-campaign-panel'
import { SiteWebsiteChangesSection } from '@/components/managed-sites/site-website-changes'
import { listAbmedCampaignSummariesForSite } from '@/lib/managed-sites/abmed/queries'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function ManagedSiteDetailPage({ params }: { params: Promise<{ locale: string; siteId: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const { siteId } = await params
  const portal = await requireCustomerMembership()
  const site = await getManagedSiteForAccount(siteId, portal.customerAccount.id)
  if (!site) notFound()
  const d = dict.dashboard
  const language = locale === 'es' ? 'es' : 'en'
  const connection = await getManagedSiteAdapter(site.adapterKey).connectionStatus(site)
  const connectionLabel = connectionStateCustomerLabel(connection.state, {
    connected: d.connectionConnected,
    manual: d.connectionManual,
    unavailable: d.connectionNotConnected,
  })
  const remoteCampaigns =
    site.adapterKey === 'abmed' ? await listAbmedCampaignSummariesForSite(site) : { ok: false as const, campaigns: [] }
  const capabilities = getCustomerVisibleCapabilities(site.capabilities)
  const campaignSection = resolveUnifiedCampaignSection(site.capabilities)
  const websiteChanges = filterWebsiteChangeCapabilities(capabilities)
  const reviewCopy =
    site.adapterKey === 'abmed' && connection.state === 'connected' ? d.siteHeaderAbmedReviewCopy : d.siteHeaderReviewCopy

  const messages = {
    saved: d.changeSaved,
    unavailable: d.changeUnavailable,
    escalated: d.changeEscalated,
    draft: d.aiDraftSaved,
    projectRequired: d.projectRequired,
    failed: d.changeUnavailable,
  }

  const changeLabels = {
    changeStatusDraft: d.changeStatusDraft,
    changeStatusAwaitingApproval: d.changeStatusAwaitingApproval,
    changeStatusApproved: d.changeStatusApproved,
    changeStatusAppliedAbmed: d.changeStatusAppliedAbmed,
    changeStatusFailed: d.changeStatusFailed,
    changeStatusEscalated: d.changeStatusEscalated,
    changeStatusCancelled: d.changeStatusCancelled,
    activityTitlePopupDraft: d.activityTitlePopupDraft,
    activityTitleCampaignUpdate: d.activityTitleCampaignUpdate,
    activityTitleContentUpdate: d.activityTitleContentUpdate,
    activityTitleCustomWork: d.activityTitleCustomWork,
  }

  const dateFormatter = new Intl.DateTimeFormat(language === 'es' ? 'es-US' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <>
      <header className="mb-8 space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{site.name}</h1>
          <p className="mt-1 text-muted-foreground">{site.domain}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${d.websiteStatusLabel}: ${siteStatusLabel(site.status, d)}`} />
          <StatusBadge label={connectionLabel} />
        </div>
        {connection.state === 'connected' && (
          <p className="text-sm font-medium text-foreground">{d.connectionDetailConnected}</p>
        )}
        {connection.state === 'connected' && <p className="text-sm text-muted-foreground">{reviewCopy}</p>}
        {connection.state === 'manual' && <p className="text-sm text-muted-foreground">{d.connectionDetailManual}</p>}
        {connection.state !== 'connected' && connection.state !== 'manual' && (
          <p className="text-sm text-muted-foreground">{d.connectionDetailNotConnected}</p>
        )}
        {isPublicHttpUrl(site.canonicalUrl) && (
          <Button render={<a href={site.canonicalUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm">
            {d.openLiveWebsite}
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {campaignSection.show && (
          <SectionCard title={d.campaignsPopupsTitle}>
            <SiteCampaignPanel
              siteId={site.id}
              capabilityKey={campaignSection.writeCapabilityKey ?? 'popups.manage'}
              campaigns={remoteCampaigns.ok ? remoteCampaigns.campaigns : []}
              connected={remoteCampaigns.ok && connection.state === 'connected'}
              canWrite={campaignSection.writeCapabilityKey != null}
              dict={d}
            />
          </SectionCard>
        )}

        <SiteWebsiteChangesSection
          capabilities={websiteChanges}
          locale={locale}
          siteId={site.id}
          connected={connection.state === 'connected'}
          dict={d}
          messages={messages}
        />

        {site.changes.length > 0 && (
          <SectionCard title={d.recentRequestsTitle}>
            <ul className="flex flex-col gap-3 text-sm">
              {site.changes.map((change) => (
                <li key={change.id} className="rounded-md border bg-background p-3">
                  <p className="font-medium">{customerActivityTitle(change.capabilityKey, changeLabels, language)}</p>
                  <p className="text-muted-foreground">
                    {customerChangeStatusLabel(change.status, change.capabilityKey, site.adapterKey, changeLabels)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFormatter.format(change.updatedAt ?? change.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
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
