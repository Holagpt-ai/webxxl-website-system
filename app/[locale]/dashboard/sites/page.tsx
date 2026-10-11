import Link from 'next/link'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { connectionStateCustomerLabel } from '@/lib/managed-sites/customer-presentation'
import { PageTitle, EmptyState, StatusBadge, SectionCard } from '@/components/dashboard/primitives'
import { Button } from '@/components/ui/button'
import { isPublicHttpUrl } from '@/lib/managed-sites/domain'

export const dynamic = 'force-dynamic'

export default async function ManagedSitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const sites = await listManagedSitesForAccount(portal.customerAccount.id)
  const d = dict.dashboard
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={d.sitesTitle} description={d.sitesDescription} />
      {sites.length === 0 ? (
        <EmptyState title={d.emptySites} body={d.emptySitesBody} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {await Promise.all(
            sites.map(async (site) => {
              const connection = await getManagedSiteAdapter(site.adapterKey).connectionStatus(site)
              const connectionLabel = connectionStateCustomerLabel(connection.state, {
                connected: d.connectionConnected,
                manual: d.connectionManual,
                unavailable: d.connectionNotConnected,
              })
              return (
                <SectionCard key={site.id} title={site.name}>
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">{site.domain}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={`${d.websiteStatusLabel}: ${siteStatusLabel(site.status, d)}`} />
                      <StatusBadge label={`${d.siteConnection}: ${connectionLabel}`} />
                    </div>
                    {site.project?.name && (
                      <p className="text-muted-foreground">
                        {d.siteLinkedProject}: <span className="text-foreground">{site.project.name}</span>
                      </p>
                    )}
                    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                      {isPublicHttpUrl(site.canonicalUrl) && (
                        <Button render={<a href={site.canonicalUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm">
                          {d.openLiveWebsite}
                        </Button>
                      )}
                      <Button render={<Link href={`${prefix}/dashboard/sites/${site.id}`} />} size="sm">
                        {d.manageWebsite}
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              )
            }),
          )}
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
