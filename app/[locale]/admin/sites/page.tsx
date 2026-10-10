import Link from 'next/link'
import { listManagedSitesForStaff, listSiteFormOptions } from '@/lib/managed-sites/queries'
import { PageTitle, EmptyState, StatusBadge, SectionCard } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { CreateManagedSiteForm } from '@/components/managed-sites/admin-forms'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }

export default async function AdminSitesPage({ params, searchParams }: Props) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const { q } = await searchParams
  const [sites, options] = await Promise.all([listManagedSitesForStaff(q), listSiteFormOptions()])
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title="Managed sites" description="Websites customers can request changes for through WebXXL." />
      <form method="get" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search customer or domain"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Search
        </button>
      </form>
      <SectionCard title="Register a site">
        <CreateManagedSiteForm customers={options.customers} projects={options.projects} />
      </SectionCard>
      <div className="mt-6">
        {sites.length === 0 ? (
          <EmptyState title="No managed sites" body="Register a customer website to assign capabilities." />
        ) : (
          <ul className="flex flex-col gap-3">
            {sites.map((site) => (
              <li key={site.id} className="rounded-xl border bg-card p-4 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{site.name}</p>
                    <p className="text-muted-foreground">
                      {site.customerAccount.businessName} · {site.domain}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={site.status} />
                      <StatusBadge label={site.connectionType} />
                    </div>
                  </div>
                  <Link href={`${prefix}/admin/sites/${site.id}`} className="text-primary hover:underline">
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
