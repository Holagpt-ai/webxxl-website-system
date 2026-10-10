import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getManagedSiteForStaff, listSiteFormOptions } from '@/lib/managed-sites/queries'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { isPublicHttpUrl } from '@/lib/managed-sites/domain'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import {
  ApproveSiteChangeButton,
  ManagedSiteCapabilityForm,
  ManagedSiteConnectionForm,
  ManagedSiteProfileForm,
} from '@/components/managed-sites/admin-forms'

export const dynamic = 'force-dynamic'

export default async function AdminSiteDetailPage({ params }: { params: Promise<{ locale: string; siteId: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const { siteId } = await params
  const site = await getManagedSiteForStaff(siteId)
  if (!site) notFound()
  const options = await listSiteFormOptions()
  const projects = options.projects.filter((project) => project.customerAccountId === site.customerAccountId)
  const connection = await getManagedSiteAdapter(site.adapterKey).connectionStatus(site)
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={site.name} description={`${site.customerAccount.businessName} · ${site.domain}`} />
      <p className="mb-6 text-sm text-muted-foreground">{connection.detail}</p>
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge label={connection.state} />
        <StatusBadge label={site.adapterKey} />
      </div>
      {site.externalAdminUrl && isPublicHttpUrl(site.externalAdminUrl) && (
        <p className="mb-6 text-sm">
          <a href={site.externalAdminUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
            Open existing site admin
          </a>
          <span className="mt-1 block text-xs text-muted-foreground">
            This opens the site&apos;s current admin. WebXXL does not control that screen natively yet.
          </span>
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Site">
          <ManagedSiteProfileForm
            siteId={site.id}
            name={site.name}
            status={site.status}
            platform={site.platform}
            canonicalUrl={site.canonicalUrl}
            externalAdminUrl={site.externalAdminUrl}
            projectId={site.projectId}
            projects={projects}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href={`${prefix}/admin/customers/${site.customerAccountId}`} className="text-primary hover:underline">
              View customer
            </Link>
            {site.project ? ` · ${site.project.name}` : ''}
          </p>
        </SectionCard>
        <SectionCard title="Connection">
          <ManagedSiteConnectionForm
            siteId={site.id}
            adapterKey={site.adapterKey}
            connectionType={site.connectionType}
            connectionRef={site.connectionRef}
          />
        </SectionCard>
      </div>
      <div className="mt-6">
        <SectionCard title="Capabilities">
          <ManagedSiteCapabilityForm siteId={site.id} assignments={site.capabilities} />
        </SectionCard>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Site change history">
          {site.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No site changes yet.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {site.changes.map((change) => (
                <li key={change.id} className="border-b pb-2">
                  <p>
                    {change.capabilityKey} · {change.executionMode} · <StatusBadge label={change.status} />
                  </p>
                  {change.requestText && <p className="mt-1 text-muted-foreground">{change.requestText}</p>}
                  {change.status === 'AWAITING_APPROVAL' && <ApproveSiteChangeButton changeId={change.id} />}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Human-required requests">
          {site.changeRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work requests from this site.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {site.changeRequests.map((request) => (
                <li key={request.id}>
                  {request.title} · <StatusBadge label={request.status} />
                  <Link href={`${prefix}/admin/requests`} className="ml-2 text-primary hover:underline">
                    Queue
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  )
}
