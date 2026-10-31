import { prisma } from '@/lib/db'
import type { ManagedSiteLeadStatus } from '@prisma/client'
import type { SiteLeadResult } from '@/lib/platform/site-leads/types'
import { SITE_LEAD_TERMINAL_STATUSES } from '@/lib/platform/site-leads/types'

async function loadLead(leadId: string, customerAccountId: string) {
  return prisma.managedSiteLead.findFirst({
    where: { id: leadId, customerAccountId },
  })
}

function assertMutable(status: ManagedSiteLeadStatus): Extract<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>, { ok: false }> | null {
  if (SITE_LEAD_TERMINAL_STATUSES.has(status) || status === 'CONVERTED') {
    return { ok: false, code: 'CONFLICT', message: 'Lead is in a terminal state' }
  }
  return null
}

export async function markSiteLeadPendingReview(
  leadId: string,
  customerAccountId: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  const lead = await loadLead(leadId, customerAccountId)
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  const blocked = assertMutable(lead.status)
  if (blocked) return blocked
  if (lead.status !== 'RECEIVED' && lead.status !== 'DUPLICATE_REVIEW') {
    return { ok: false, code: 'CONFLICT', message: 'Lead cannot move to pending review from current state' }
  }
  const updated = await prisma.managedSiteLead.update({
    where: { id: lead.id },
    data: { status: 'PENDING_REVIEW' },
    select: { id: true, status: true },
  })
  return { ok: true, value: updated }
}

export async function qualifySiteLead(
  leadId: string,
  customerAccountId: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  const lead = await loadLead(leadId, customerAccountId)
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  const blocked = assertMutable(lead.status)
  if (blocked) return blocked
  if (!['RECEIVED', 'PENDING_REVIEW', 'DUPLICATE_REVIEW'].includes(lead.status)) {
    return { ok: false, code: 'CONFLICT', message: 'Lead cannot be qualified from current state' }
  }
  const updated = await prisma.managedSiteLead.update({
    where: { id: lead.id },
    data: { status: 'QUALIFIED', qualifiedAt: new Date() },
    select: { id: true, status: true },
  })
  return { ok: true, value: updated }
}

export async function rejectSiteLead(
  leadId: string,
  customerAccountId: string,
  reason?: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  const lead = await loadLead(leadId, customerAccountId)
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  const blocked = assertMutable(lead.status)
  if (blocked) return blocked
  if (lead.status === 'CONVERTED') {
    return { ok: false, code: 'CONFLICT', message: 'Converted lead cannot be rejected' }
  }
  const updated = await prisma.managedSiteLead.update({
    where: { id: lead.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason?.trim().slice(0, 500) ?? null,
    },
    select: { id: true, status: true },
  })
  return { ok: true, value: updated }
}
