import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { listAdminAutomationJobs } from '@/lib/automation/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { adminRetryDeliveryJobFormAction } from '@/lib/automation/admin-actions'
import { isAuthEmailConfigured } from '@/lib/integrations/email'
import { isEnabled } from '@/config/features'
import type { AutomationDeliveryStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

function isDeliveryStatus(value: string): value is AutomationDeliveryStatus {
  return ['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD'].includes(value)
}

export default async function AdminAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; q?: string; customerAccountId?: string }>
}) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const sp = await searchParams
  const status = sp.status && isDeliveryStatus(sp.status) ? sp.status : undefined
  const jobs = await listAdminAutomationJobs({ status, q: sp.q, customerAccountId: sp.customerAccountId })

  return (
    <>
      <PageTitle
        title="Automation & notifications"
        description="Queued delivery jobs, sanitized errors, and provider status. No bulk promotional email."
      />
      <ul className="mb-6 text-sm text-muted-foreground">
        <li>Email provider: {isAuthEmailConfigured() ? 'configured' : 'not configured'}</li>
        <li>Worker endpoint: {isEnabled('automationWorker') ? 'enabled (cron not scheduled in Batch 13)' : 'disabled'}</li>
        <li>SMS / WhatsApp / Push: disabled by feature flags</li>
      </ul>
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="Search jobs…" className="min-w-[200px] rounded-md border px-3 py-2 text-sm" />
        <select name="status" defaultValue={status ?? ''} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>
      {jobs.length === 0 ? (
        <EmptyState title="No delivery jobs" body="Automation events will enqueue jobs here." />
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {job.event.eventType} · {job.channel}
                </p>
                <StatusBadge label={job.status} />
              </div>
              <p className="text-muted-foreground">
                {job.event.customerAccount?.businessName ?? 'Staff / global'} · attempts {job.attempts}/{job.maxAttempts}
              </p>
              {job.lastErrorClass && <p className="text-xs text-muted-foreground">Error: {job.lastErrorClass}</p>}
              {job.deliveredAt && (
                <p className="text-xs text-muted-foreground">Delivered: {job.deliveredAt.toISOString()}</p>
              )}
              {(job.status === 'FAILED' || job.status === 'DEAD') && (
                <form action={adminRetryDeliveryJobFormAction} className="mt-2">
                  <input type="hidden" name="jobId" value={job.id} />
                  <button type="submit" className="text-xs text-primary underline">
                    Retry delivery
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-muted-foreground">Locale: {locale}</p>
    </>
  )
}
