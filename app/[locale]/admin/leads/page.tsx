import Link from 'next/link'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { listSalesLeads } from '@/lib/admin/lead-queries'
import { LEAD_STAGE_LABELS, LEAD_PIPELINE_STAGES, isLeadPipelineStage } from '@/lib/leads/pipeline'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ stage?: string; q?: string }>
}) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const sp = await searchParams
  const stage = sp.stage && isLeadPipelineStage(sp.stage) ? sp.stage : undefined
  const leads = await listSalesLeads({ stage, q: sp.q })
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle
        title="Leads"
        description="Website inquiries and project intake submissions. Newsletter signups are kept separate."
      />
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search email, name, reference…"
          className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select name="stage" defaultValue={stage ?? ''} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All stages</option>
          {LEAD_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>
      {leads.length === 0 ? (
        <EmptyState title="No leads yet" body="New contact and get-started submissions will appear here after email delivery." />
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link href={`${prefix}/admin/leads/${lead.id}`} className="font-semibold text-primary hover:underline">
                    {lead.businessName || lead.contactName || lead.contactEmail}
                  </Link>
                  <p className="text-muted-foreground">
                    {lead.contactEmail}
                    {lead.referenceCode ? ` · ${lead.referenceCode}` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {lead.source.replace('_', ' ')} · {lead.locale.toUpperCase()}
                    {lead.assignedTo ? ` · ${lead.assignedTo.name || lead.assignedTo.email}` : ''}
                  </p>
                  {lead.headline && <p className="mt-1 line-clamp-2">{lead.headline}</p>}
                </div>
                <StatusBadge label={LEAD_STAGE_LABELS[lead.stage]} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
