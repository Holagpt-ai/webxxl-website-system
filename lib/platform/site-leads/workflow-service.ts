import type { ManagedSiteLeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { SiteLeadResult } from '@/lib/platform/site-leads/types'

async function transitionLeadStatus(input: {
  leadId: string
  customerAccountId: string
  allowedFrom: ManagedSiteLeadStatus[]
  to: ManagedSiteLeadStatus
  data?: Prisma.ManagedSiteLeadUpdateManyMutationInput
}): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  const updated = await prisma.managedSiteLead.updateMany({
    where: {
      id: input.leadId,
      customerAccountId: input.customerAccountId,
      status: { in: input.allowedFrom },
    },
    data: { status: input.to, ...input.data },
  })
  if (updated.count === 1) {
    return { ok: true, value: { id: input.leadId, status: input.to } }
  }
  const current = await prisma.managedSiteLead.findFirst({
    where: { id: input.leadId, customerAccountId: input.customerAccountId },
    select: { status: true },
  })
  if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  return { ok: false, code: 'CONFLICT', message: 'Lead status transition conflict' }
}

export async function markSiteLeadPendingReview(
  leadId: string,
  customerAccountId: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  return transitionLeadStatus({
    leadId,
    customerAccountId,
    allowedFrom: ['RECEIVED', 'DUPLICATE_REVIEW'],
    to: 'PENDING_REVIEW',
  })
}

export async function qualifySiteLead(
  leadId: string,
  customerAccountId: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  return transitionLeadStatus({
    leadId,
    customerAccountId,
    allowedFrom: ['RECEIVED', 'PENDING_REVIEW', 'DUPLICATE_REVIEW'],
    to: 'QUALIFIED',
    data: { qualifiedAt: new Date() },
  })
}

export async function rejectSiteLead(
  leadId: string,
  customerAccountId: string,
  reason?: string,
): Promise<SiteLeadResult<{ id: string; status: ManagedSiteLeadStatus }>> {
  return transitionLeadStatus({
    leadId,
    customerAccountId,
    allowedFrom: ['RECEIVED', 'PENDING_REVIEW', 'QUALIFIED', 'DUPLICATE_REVIEW'],
    to: 'REJECTED',
    data: {
      rejectedAt: new Date(),
      rejectionReason: reason?.trim().slice(0, 500) ?? null,
    },
  })
}
