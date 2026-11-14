import { prisma } from '@/lib/db'
import type { SupportRequestStatus } from '@prisma/client'

export const CUSTOMER_REPLY_STATUSES: SupportRequestStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER']

export async function listSupportMessages(supportRequestId: string, customerAccountId: string) {
  const ticket = await prisma.supportRequest.findFirst({
    where: { id: supportRequestId, customerAccountId },
    select: { id: true },
  })
  if (!ticket) return null
  return prisma.supportRequestMessage.findMany({
    where: { supportRequestId, visibility: 'CUSTOMER' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function addCustomerSupportReply(input: {
  supportRequestId: string
  customerAccountId: string
  authorUserId: string
  body: string
}): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'closed' | 'empty' }> {
  const text = input.body.trim()
  if (!text) return { ok: false, error: 'empty' }

  const ticket = await prisma.supportRequest.findFirst({
    where: { id: input.supportRequestId, customerAccountId: input.customerAccountId },
    select: { id: true, status: true, projectId: true },
  })
  if (!ticket) return { ok: false, error: 'not_found' }
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return { ok: false, error: 'closed' }
  if (!CUSTOMER_REPLY_STATUSES.includes(ticket.status)) return { ok: false, error: 'closed' }

  await prisma.$transaction([
    prisma.supportRequestMessage.create({
      data: {
        supportRequestId: ticket.id,
        authorUserId: input.authorUserId,
        body: text,
        visibility: 'CUSTOMER',
      },
    }),
    prisma.supportRequest.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status === 'WAITING_ON_CUSTOMER' ? 'IN_PROGRESS' : ticket.status,
        updatedAt: new Date(),
      },
    }),
  ])

  return { ok: true }
}