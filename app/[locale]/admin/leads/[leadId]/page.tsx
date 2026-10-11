import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { getSalesLeadDetail, listStaffForLeadAssignment } from '@/lib/admin/lead-queries'
import { listCustomers } from '@/lib/admin/queries'
import { LEAD_STAGE_LABELS } from '@/lib/leads/pipeline'
import { PageTitle, StatusBadge } from '@/components/dashboard/primitives'
import {
  LeadAssignForm,
  LeadConvertForm,
  LeadFollowUpForm,
  LeadNoteForm,
  LeadStageForm,
} from '@/components/admin/lead-forms'

export const dynamic = 'force-dynamic'

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ locale: string; leadId: string }>
}) {
  await requireStaff()
  const { locale, leadId } = await params
  await resolveLocale(params)
  const lead = await getSalesLeadDetail(leadId)
  if (!lead) notFound()
  const staff = await listStaffForLeadAssignment()
  const customers = await listCustomers()
  const prefix = locale === 'es' ? '/es' : ''
  const converted = Boolean(lead.customerAccountId && lead.projectId)
  const defaultProjectName = lead.businessName ? `${lead.businessName} website` : 'New website project'

  return (
    <>
      <PageTitle
        title={lead.businessName || lead.contactName || 'Lead'}
        description={`${LEAD_STAGE_LABELS[lead.stage]} · ${lead.referenceCode}`}
      />
      <Link href={`${prefix}/admin/leads`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← All leads
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <p>
            {lead.contactName ?? '—'}
            <br />
            {lead.contactEmail}
            {lead.contactPhone ? ` · ${lead.contactPhone}` : ''}
          </p>
          <p className="text-muted-foreground">
            Source: {lead.source} · Locale: {lead.locale}
          </p>
          {lead.headline && <p>{lead.headline}</p>}
          {lead.internalNotes && (
            <div>
              <h3 className="font-medium">Internal notes</h3>
              <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{lead.internalNotes}</pre>
            </div>
          )}
          <LeadStageForm leadId={lead.id} current={lead.stage} />
          <LeadAssignForm leadId={lead.id} currentAssigneeId={lead.assignedToId} staff={staff} />
          <LeadFollowUpForm leadId={lead.id} followUpAt={lead.followUpAt} />
          <LeadNoteForm leadId={lead.id} />
        </section>

        <section className="space-y-4">
          <LeadConvertForm
            leadId={lead.id}
            defaultBusinessName={lead.businessName ?? lead.contactName ?? ''}
            defaultProjectName={defaultProjectName}
            defaultEmail={lead.contactEmail}
            customers={customers.map((c) => ({ id: c.id, businessName: c.businessName, slug: c.slug }))}
            converted={converted}
          />
          {converted && lead.customerAccount && lead.project && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <h2 className="font-semibold">Handoff</h2>
              <p className="mt-2">
                <Link href={`${prefix}/admin/customers/${lead.customerAccount.id}`} className="text-primary hover:underline">
                  {lead.customerAccount.businessName}
                </Link>
              </p>
              <p>
                <Link href={`${prefix}/admin/projects/${lead.project.id}`} className="text-primary hover:underline">
                  {lead.project.name}
                </Link>{' '}
                <StatusBadge label={lead.project.status} />
              </p>
            </div>
          )}
          <div className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="font-semibold">Submission payload</h2>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
              {JSON.stringify(lead.payload, null, 2)}
            </pre>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Activity</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {lead.activities.map((item) => (
            <li key={item.id} className="border-b pb-2 last:border-0">
              <p>{item.summary}</p>
              <p className="text-xs text-muted-foreground">
                {item.type} · {item.createdAt.toLocaleString()}
                {item.actor ? ` · ${item.actor.name || item.actor.email}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
