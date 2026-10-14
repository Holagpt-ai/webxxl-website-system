import { prisma } from '@/lib/db'
import type { LeadStage } from '@prisma/client'

export async function listSalesLeads(filters?: {
  stage?: LeadStage
  assignedToId?: string
  q?: string
}) {
  const q = filters?.q?.trim()
  return prisma.salesLead.findMany({
    where: {
      stage: filters?.stage,
      assignedToId: filters?.assignedToId,
      ...(q
        ? {
            OR: [
              { contactEmail: { contains: q, mode: 'insensitive' } },
              { contactName: { contains: q, mode: 'insensitive' } },
              { businessName: { contains: q, mode: 'insensitive' } },
              { referenceCode: { contains: q, mode: 'insensitive' } },
              { headline: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      customerAccount: { select: { id: true, businessName: true, slug: true } },
      project: { select: { id: true, name: true, status: true } },
    },
  })
}

export async function getSalesLeadDetail(leadId: string) {
  return prisma.salesLead.findUnique({
    where: { id: leadId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      customerAccount: { select: { id: true, businessName: true, slug: true } },
      project: { select: { id: true, name: true, status: true, templateId: true, templateVersion: true } },
      convertedBy: { select: { id: true, name: true, email: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  })
}

export async function listStaffForLeadAssignment() {
  return prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] } },
    orderBy: { email: 'asc' },
    select: { id: true, name: true, email: true, role: true },
  })
}

export async function countOpenSalesLeads() {
  return prisma.salesLead.count({
    where: { stage: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT'] } },
  })
}
