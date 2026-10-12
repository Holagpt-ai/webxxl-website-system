import Link from 'next/link'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { listSalesLeads } from '@/lib/admin/lead-queries'
import { LEAD_PIPELINE_STAGES, isLeadPipelineStage } from '@/lib/leads/pipeline'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
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
  const copy = getDictionary(locale).admin
  const sp = await searchParams
  const stage = sp.stage && isLeadPipelineStage(sp.stage) ? sp.stage : undefined
  const leads = await listSalesLeads({ stage, q: sp.q })
  const prefix = locale === 'es' ? '/es' : ''

  return (
    <>
      <PageTitle title={copy.leads.title} description={copy.leads.description} />
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder={copy.leads.searchPlaceholder}
          className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select name="stage" defaultValue={stage ?? ''} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">{copy.leads.allStages}</option>
          {LEAD_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {enumLabel(copy.leads.stages, s)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {copy.search}
        </button>
      </form>
      {leads.length === 0 ? (
        <EmptyState title={copy.leads.emptyTitle} body={copy.leads.emptyBody} />
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
                <StatusBadge label={enumLabel(copy.leads.stages, lead.stage)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
