import Link from 'next/link'
import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { PageTitle, EmptyState, StatusBadge, SectionCard } from '@/components/dashboard/primitives'

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
              return (
                <SectionCard key={site.id} title={site.name}>
                  <p className="text-sm">{site.domain}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge label={siteStatusLabel(site.status, d)} />
                    <StatusBadge label={connectionLabel(connection.state, d)} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{connectionDetail(connection.state, d)}</p>
                  <Link href={`${prefix}/dashboard/sites/${site.id}`} className="mt-4 inline-block text-sm text-primary hover:underline">
                    {d.siteCapabilities}
                  </Link>
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

function connectionLabel(state: string, d: { connectionConnected: string; connectionManual: string; connectionNotConnected: string }) {
  if (state === 'connected') return d.connectionConnected
  if (state === 'manual') return d.connectionManual
  return d.connectionNotConnected
}

function connectionDetail(
  state: string,
  d: { connectionDetailConnected: string; connectionDetailManual: string; connectionDetailNotConnected: string },
) {
  if (state === 'connected') return d.connectionDetailConnected
  if (state === 'manual') return d.connectionDetailManual
  return d.connectionDetailNotConnected
}
