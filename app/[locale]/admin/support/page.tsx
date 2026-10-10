import Link from 'next/link'
import { listSupportQueue } from '@/lib/admin/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { SupportStatusForm } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const tickets = await listSupportQueue()
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title="Support queue" description="Customer support requests." />
      {tickets.length === 0 ? (
        <EmptyState title="No support requests" body="Tickets from the customer portal will appear here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {tickets.map((sr) => (
            <li key={sr.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                <div>
                  <p className="font-semibold">{sr.subject}</p>
                  <p className="text-muted-foreground">
                    {sr.customerAccount.businessName}
                    {sr.project ? ` · ${sr.project.name}` : ''}
                  </p>
                  <StatusBadge label={sr.status} />
                  <p className="mt-2 line-clamp-4 text-muted-foreground">{sr.message}</p>
                  {sr.projectId && (
                    <Link href={`${prefix}/admin/projects/${sr.projectId}`} className="mt-2 inline-block text-primary hover:underline">
                      Project
                    </Link>
                  )}
                  <Link href={`${prefix}/admin/customers/${sr.customerAccountId}`} className="ml-3 text-primary hover:underline">
                    Customer
                  </Link>
                </div>
                <SupportStatusForm supportRequestId={sr.id} current={sr.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
