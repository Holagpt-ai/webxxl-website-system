import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { getAdminServiceOrderDetail } from '@/lib/marketplace/queries'
import { listStaffForLeadAssignment } from '@/lib/admin/lead-queries'
import { PageTitle, StatusBadge } from '@/components/dashboard/primitives'
import {
  ServiceOrderActivateEntitlementButton,
  ServiceOrderAssignForm,
  ServiceOrderQuoteForm,
  ServiceOrderStatusForm,
} from '@/components/admin/service-order-forms'
import { getMarketplaceService } from '@/lib/marketplace/catalog'

export const dynamic = 'force-dynamic'

export default async function AdminServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>
}) {
  await requireStaff()
  const { locale, orderId } = await params
  await resolveLocale(params)
  const order = await getAdminServiceOrderDetail(orderId)
  if (!order) notFound()
  const staff = await listStaffForLeadAssignment()
  const definition = getMarketplaceService(order.serviceKey)
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={order.publicId} description={`${order.customerAccount.businessName} · ${order.serviceKey}`} />
      <Link href={`${prefix}/admin/service-orders`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← All service orders
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4 text-sm">
          <StatusBadge label={order.status} />
          <p>Requested by: {order.requestedBy.name || order.requestedBy.email}</p>
          {order.customerNotes && (
            <div>
              <p className="font-medium">Customer notes</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{order.customerNotes}</p>
            </div>
          )}
          {order.quoteAmountCents != null && (
            <p>
              Quote: {(order.quoteAmountCents / 100).toFixed(2)} {order.quoteCurrency ?? 'USD'}
              {order.quoteNotes ? ` — ${order.quoteNotes}` : ''}
            </p>
          )}
          <ServiceOrderStatusForm orderId={order.id} current={order.status} />
          <ServiceOrderAssignForm orderId={order.id} currentAssigneeId={order.assignedToId} staff={staff} />
          <ServiceOrderQuoteForm orderId={order.id} />
          <ServiceOrderActivateEntitlementButton
            orderId={order.id}
            status={order.status}
            hasEntitlement={Boolean(order.customerServiceId)}
          />
          {definition?.registryEntitlementKey && (
            <p className="text-xs text-muted-foreground">
              Maps to entitlement key: {definition.registryEntitlementKey} (manual activation only)
            </p>
          )}
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-4 text-sm">
          <p>
            Customer:{' '}
            <Link href={`${prefix}/admin/customers/${order.customerAccount.id}`} className="text-primary hover:underline">
              {order.customerAccount.businessName}
            </Link>
          </p>
          {order.project && (
            <p>
              Project:{' '}
              <Link href={`${prefix}/admin/projects/${order.project.id}`} className="text-primary hover:underline">
                {order.project.name}
              </Link>
            </p>
          )}
          {order.internalNotes && (
            <div>
              <p className="font-medium">Internal notes (staff only)</p>
              <pre className="whitespace-pre-wrap text-muted-foreground">{order.internalNotes}</pre>
            </div>
          )}
        </section>
      </div>
      <section className="mt-8 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.activities.map((item) => (
            <li key={item.id}>
              {item.summary}
              <span className="ml-2 text-xs text-muted-foreground">{item.createdAt.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
