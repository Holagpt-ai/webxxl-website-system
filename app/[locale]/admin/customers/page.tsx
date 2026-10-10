import Link from 'next/link'
import { listCustomers } from '@/lib/admin/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }

export default async function AdminCustomersPage({ params, searchParams }: Props) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const { q } = await searchParams
  const customers = await listCustomers(q)
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title="Customers" description="Search and manage customer accounts." />
      <form method="get" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name, slug, email…"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Search
        </button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title="No customers" body={q ? 'No matches for your search.' : 'No customer accounts in the database yet.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Projects</th>
                <th className="px-4 py-3">Members</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`${prefix}/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.businessName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={c.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c._count.projects}</td>
                  <td className="px-4 py-3 tabular-nums">{c._count.memberships}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
