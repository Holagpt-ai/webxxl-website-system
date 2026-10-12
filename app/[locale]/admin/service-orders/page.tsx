import Link from 'next/link'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'
import { listAdminServiceOrders } from '@/lib/marketplace/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import type { ServiceOrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

function isServiceOrderStatus(value: string): value is ServiceOrderStatus {
  return [
    'REQUESTED',
    'UNDER_REVIEW',
    'QUOTED',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
  ].includes(value)
}

export default async function AdminServiceOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const copy = dict.admin
  const sp = await searchParams
  const status = sp.status && isServiceOrderStatus(sp.status) ? sp.status : undefined
  const orders = await listAdminServiceOrders({ status, q: sp.q })
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={copy.serviceOrders.title} description={copy.serviceOrders.description} />
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder={copy.serviceOrders.searchPlaceholder}
          className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status ?? ''} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>
      {orders.length === 0 ? (
        <EmptyState title={copy.serviceOrders.emptyTitle} body={copy.serviceOrders.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border bg-card p-4 text-sm">
              <Link href={`${prefix}/admin/service-orders/${order.id}`} className="font-semibold text-primary hover:underline">
                {order.publicId}
              </Link>
              <p className="text-muted-foreground">
                {order.customerAccount.businessName} · {order.serviceKey}
              </p>
              <StatusBadge label={enumLabel(dict.dashboard.marketplaceOrderStatusLabels, order.status)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
